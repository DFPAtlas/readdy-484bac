-- A Stripe invoice is one ledger entry, including payment recovery and concurrent events.
create unique index if not exists subscription_payments_invoice_unique
  on app.subscription_payments(stripe_invoice_id);

-- Called only after the Edge Function validates the caller's Supabase session.
-- Keep funding state intact: disputed is an independent finance hold.
create or replace function app.raise_client_payment_dispute(
  p_user_id uuid, p_job_id uuid, p_assignment_id uuid, p_reason text, p_details text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  job app.jobs;
  assignment app.job_assignments;
  client app.clients;
  dispute app.disputes;
begin
  if p_user_id is null or p_reason is null or length(trim(p_reason)) not between 1 and 2000
    or coalesce(length(p_details),0)>10000 then raise exception 'Invalid dispute request'; end if;
  select * into client from app.clients where user_id=p_user_id;
  if not found then raise exception 'Client profile required'; end if;
  select * into job from app.jobs where id=p_job_id for update;
  if not found or job.client_id is distinct from client.id then raise exception 'You can only dispute your own jobs'; end if;
  select * into assignment from app.job_assignments where id=p_assignment_id and job_id=job.id for update;
  if not found then raise exception 'Assignment does not belong to this job'; end if;
  if coalesce(job.is_deleted,false) or job.status in ('draft','cancelled','closed')
    or coalesce(job.payment_status,'') not in ('funded','payout_pending','payout_processing','paid_out','paid','client_released') then
    raise exception 'Job is not eligible for a payment dispute';
  end if;
  if coalesce(job.disputed,false) then
    select * into dispute from app.disputes where job_id=job.id and assignment_id=assignment.id and status='open' order by created_at limit 1;
    if found then return jsonb_build_object('disputeId',dispute.id,'replayed',true); end if;
    raise exception 'This job already has an active finance hold';
  end if;
  if exists(select 1 from app.financial_operations where job_id=job.id and state in ('processing','reconciliation_required')) then
    raise exception 'A financial operation is processing; finance review required';
  end if;
  insert into app.disputes(job_id,client_id,guard_id,assignment_id,raised_by,reason,details,status)
    values(job.id,client.id,assignment.guard_id,assignment.id,'client',trim(p_reason),p_details,'open') returning * into dispute;
  update app.jobs set disputed=true,disputed_at=now(),disputed_reason=trim(p_reason),updated_at=now() where id=job.id;
  insert into app.payment_audit_logs(job_id,assignment_id,guard_id,client_id,from_status,to_status,
    changed_by,changed_by_role,event_type,reference_type,reference_id,details)
    values(job.id,assignment.id,assignment.guard_id,client.id,job.payment_status,'disputed',p_user_id,'client',
      'client.dispute.created','dispute',dispute.id::text,jsonb_build_object('reason',trim(p_reason)));
  return jsonb_build_object('disputeId',dispute.id,'replayed',false);
end $$;
revoke all on function app.raise_client_payment_dispute(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function app.raise_client_payment_dispute(uuid,uuid,uuid,text,text) to service_role;
