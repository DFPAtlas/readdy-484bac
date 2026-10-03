-- Apply before deploying the financial handlers in this repair.
-- A durable per-job gate survives process crashes and uncertain Stripe responses.
create table if not exists app.financial_operations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references app.jobs(id),
  operation_key text not null unique,
  kind text not null check (kind in ('refund','payout','dispute')),
  state text not null default 'processing' check (state in ('processing','completed','failed','reconciliation_required')),
  actor_id uuid,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists financial_operations_one_active_job
  on app.financial_operations(job_id) where state in ('processing','reconciliation_required');
alter table app.financial_operations enable row level security;
revoke all on app.financial_operations from public, anon, authenticated;
grant select, insert, update on app.financial_operations to service_role;
grant select on app.financial_operations to authenticated;
create policy financial_operations_finance_read on app.financial_operations for select to authenticated
using (exists(select 1 from app.admin_users a where a.user_id = (select auth.uid()) and a.is_active and a.role in ('super_admin','finance_admin')));
create policy financial_operations_service on app.financial_operations for all to service_role using (true) with check (true);

create or replace function app.claim_financial_operation(p_job_id uuid, p_key text, p_kind text, p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing app.financial_operations; operation app.financial_operations;
begin
  if p_key is null or length(p_key) not between 1 and 200 or p_kind not in ('refund','payout','dispute') then raise exception 'Invalid financial operation'; end if;
  perform 1 from app.jobs where id=p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  select * into existing from app.financial_operations where operation_key=p_key;
  if found then
    if existing.job_id <> p_job_id or existing.kind <> p_kind then raise exception 'Operation key mismatch'; end if;
    if existing.state='completed' then return jsonb_build_object('replayed',true,'id',existing.id,'result',existing.result); end if;
    if existing.state <> 'failed' then raise exception 'Financial operation requires reconciliation or is already processing'; end if;
  end if;
  if exists(select 1 from app.financial_operations where job_id=p_job_id and state in ('processing','reconciliation_required')) then raise exception 'Another financial operation is processing; finance review required'; end if;
  if existing.id is not null then
    update app.financial_operations set state='processing',actor_id=p_actor,updated_at=now() where id=existing.id returning * into operation;
  else
    insert into app.financial_operations(job_id,operation_key,kind,actor_id) values(p_job_id,p_key,p_kind,p_actor) returning * into operation;
  end if;
  return jsonb_build_object('replayed',false,'id',operation.id);
end $$;
revoke all on function app.claim_financial_operation(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function app.claim_financial_operation(uuid,text,text,uuid) to service_role;

-- Stripe success and the related local records are committed in one DB transaction.
create or replace function app.record_financial_refund(p_operation_id uuid,p_transaction_id uuid,p_dispute_id uuid,p_refund_id text,p_cumulative_refund numeric,p_refund_amount numeric,p_succeeded boolean,p_role text,p_resolution text,p_notes text)
returns void language plpgsql security invoker set search_path = '' as $$
declare operation app.financial_operations; payment app.transactions; full_refund boolean; next_state text;
begin
  select * into operation from app.financial_operations where id=p_operation_id for update;
  if not found or operation.state <> 'processing' or operation.kind <> 'refund' then raise exception 'Refund operation not active'; end if;
  select * into payment from app.transactions where id=p_transaction_id and job_id=operation.job_id for update;
  if not found or p_cumulative_refund is null or p_refund_amount is null or p_refund_id is null or p_succeeded is null or p_cumulative_refund < coalesce(payment.refund_amount,0) or p_cumulative_refund > payment.amount or p_refund_amount <= 0 then raise exception 'Invalid payment reconciliation'; end if;
  if exists(select 1 from app.job_assignments where job_id=operation.job_id and (payout_released or stripe_transfer_id is not null or payment_status in ('payout_pending','payout_processing','paid_out','paid','client_released'))) or exists(select 1 from app.guard_payouts where job_id=operation.job_id and (stripe_transfer_id is not null or status not in ('failed','cancelled'))) then raise exception 'Payout has started; refund reconciliation requires review'; end if;
  full_refund := p_cumulative_refund >= payment.amount;
  next_state := case when p_succeeded then case when full_refund then 'refunded' else 'partially_refunded' end else 'refund_pending' end;
  update app.transactions set stripe_refund_id=p_refund_id,
    refund_amount=case when p_succeeded then greatest(coalesce(refund_amount,0),p_cumulative_refund) else refund_amount end,
    refunded=case when p_succeeded then full_refund else refunded end,
    status=case when p_succeeded then next_state else status end,
    refunded_at=case when p_succeeded then now() else refunded_at end,updated_at=now() where id=payment.id;
  -- Keep operational partial/pending bookings funded; transaction and audit hold refund state.
  update app.jobs set payment_status=case when full_refund and p_succeeded then 'refunded' else payment_status end,
    status=case when full_refund and p_succeeded then 'cancelled' else status end,
    disputed=not p_succeeded,disputed_at=case when p_succeeded then null else now() end,disputed_reason=case when p_succeeded then null else 'Refund pending' end,updated_at=now() where id=operation.job_id;
  if full_refund and p_succeeded then
    update app.job_assignments set status='cancelled',payment_status='refunded',updated_at=now() where job_id=operation.job_id;
  end if;
  if p_dispute_id is not null then
    update app.disputes set status=p_resolution,resolution=p_resolution,admin_notes=p_notes,
      refund_amount=p_refund_amount,stripe_refund_id=p_refund_id,resolved_at=now(),updated_at=now()
      where id=p_dispute_id and job_id=operation.job_id;
    if not found then raise exception 'Dispute mismatch'; end if;
  end if;
  insert into app.payment_audit_logs(job_id,client_id,from_status,to_status,changed_by,changed_by_role,reason,event_type,reference_type,reference_id,metadata)
    values(operation.job_id,payment.client_id,payment.status,next_state,operation.actor_id,p_role,p_notes,'job_refund_recorded','transaction',payment.id::text,
      jsonb_build_object('stripe_refund_id',p_refund_id,'refund_amount',p_refund_amount,'cumulative_refund',p_cumulative_refund,'operation_id',operation.id));
  update app.financial_operations set state=case when p_succeeded then 'completed' else 'reconciliation_required' end,
    result=jsonb_build_object('success',true,'stripeRefundId',p_refund_id,'refundId',p_refund_id,'refundAmount',p_refund_amount,'status',case when p_succeeded then 'succeeded' else 'pending' end),updated_at=now() where id=operation.id;
end $$;
revoke all on function app.record_financial_refund(uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text) from public,anon,authenticated;
grant execute on function app.record_financial_refund(uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text) to service_role;
