create or replace function app.record_requested_refund(p_request_id uuid,p_operation_id uuid,p_transaction_id uuid,p_dispute_id uuid,p_refund_id text,p_cumulative_refund numeric,p_refund_amount numeric,p_succeeded boolean,p_role text,p_resolution text,p_notes text)
returns void language plpgsql security invoker set search_path = '' as $$
declare request app.refund_requests; operation app.financial_operations;
begin
  select * into operation from app.financial_operations where id=p_operation_id for update;
  select * into request from app.refund_requests where id=p_request_id for update;
  if request.id is null or operation.id is null or request.job_id<>operation.job_id or request.transaction_id<>p_transaction_id or request.status not in ('pending','approved') or request.stripe_refund_id is not null or request.requested_amount<>p_refund_amount or p_dispute_id is not null then raise exception 'Refund request reconciliation mismatch'; end if;
  perform app.record_financial_refund(p_operation_id,p_transaction_id,p_dispute_id,p_refund_id,p_cumulative_refund,p_refund_amount,p_succeeded,p_role,p_resolution,p_notes);
  update app.refund_requests set status=case when p_succeeded then 'completed' else 'processing' end,approved_amount=p_refund_amount,stripe_refund_id=p_refund_id,processed_at=case when p_succeeded then now() else null end,updated_at=now() where id=p_request_id;
end $$;
revoke all on function app.record_requested_refund(uuid,uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text) from public,anon,authenticated;
grant execute on function app.record_requested_refund(uuid,uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text) to service_role;
