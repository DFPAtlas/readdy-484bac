-- Cancellation and its requested resolution commit together. No Stripe transfer occurs here.
create or replace function public.cancel_client_job(p_job_id uuid, p_reason text default null, p_notes text default null, p_resolution text default null, p_contact text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  booking app.jobs; cancellation app.job_cancellations; payment app.transactions;
  refund app.refund_requests; actor uuid := auth.uid(); remaining numeric;
  resolution text; reason text; contact text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into booking from app.jobs where id=p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if not exists(select 1 from app.clients where id=booking.client_id and user_id=actor) then raise exception 'You do not own this job'; end if;
  if booking.status not in ('draft','open','pending','awaiting_guard_selection','awaiting_payment','funded','confirmed','in_progress','cancelled') then raise exception 'This job cannot be cancelled; contact support'; end if;
  if exists(select 1 from app.financial_operations where job_id=p_job_id and state in ('processing','reconciliation_required')) or exists(select 1 from app.job_assignments where job_id=p_job_id and (payout_released or stripe_transfer_id is not null or payment_status in ('payout_pending','payout_processing','paid_out','paid','client_released'))) or exists(select 1 from app.guard_payouts where job_id=p_job_id and (stripe_transfer_id is not null or status not in ('failed','cancelled'))) then raise exception 'Payment operation or payout already started; contact support'; end if;
  select * into cancellation from app.job_cancellations where job_id=p_job_id and cancelled_by='client' order by created_at desc limit 1 for update;
  resolution := coalesce(cancellation.preferred_resolution,p_resolution,'full_refund');
  reason := coalesce(nullif(trim(cancellation.reason),''),nullif(trim(p_reason),''));
  contact := coalesce(cancellation.contact_preference,p_contact,'email');
  if reason is null or length(reason)>500 or resolution not in ('full_refund','partial_refund','credit','admin_review') or contact not in ('email','phone') or length(coalesce(p_notes,''))>5000 then raise exception 'Invalid cancellation details'; end if;
  if cancellation.id is null then
    insert into app.job_cancellations(job_id,client_id,cancelled_by,reason,notes,preferred_resolution,contact_preference,status,cancelled_at)
    values(p_job_id,booking.client_id,'client',reason,nullif(trim(p_notes),''),resolution,contact,'cancelled',now()) returning * into cancellation;
  else
    update app.job_cancellations set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now() where id=cancellation.id;
  end if;
  select * into payment from app.transactions where job_id=p_job_id and transaction_type='job_payment' and status in ('completed','partially_refunded','refunded') order by created_at desc limit 1 for update;
  if payment.id is not null then
    remaining := greatest(0,payment.amount-coalesce(payment.refund_amount,0));
    select * into refund from app.refund_requests where job_id=p_job_id and transaction_id=payment.id and status in ('pending','approved','processing','completed','processed','credit_issued') order by created_at desc limit 1 for update;
    if remaining>0 and refund.id is null then
      insert into app.refund_requests(job_id,client_id,cancellation_id,transaction_id,requested_amount,reason,type,status,notes)
      values(p_job_id,booking.client_id,cancellation.id,payment.id,remaining,reason,case when resolution='partial_refund' then 'partial' else 'full' end,'pending',concat('Cancellation resolution: ',resolution,'. ',coalesce(cancellation.notes,p_notes,''))) returning * into refund;
    end if;
  elsif booking.payment_status='funded' then
    raise exception 'Funded payment record not found; contact support';
  end if;
  update app.jobs set status='cancelled',updated_at=now() where id=p_job_id;
  update app.job_assignments set status='cancelled',updated_at=now() where job_id=p_job_id;
  return jsonb_build_object('success',true,'jobId',p_job_id,'cancellationId',cancellation.id,'refundRequestId',refund.id,'refundStatus',coalesce(refund.status,case when payment.refunded then 'completed' else 'not_required' end),'requestedAmount',coalesce(refund.requested_amount,0));
end $$;
revoke all on function public.cancel_client_job(uuid,text,text,text,text) from public,anon;
grant execute on function public.cancel_client_job(uuid,text,text,text,text) to authenticated;
