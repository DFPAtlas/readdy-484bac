-- Forwarder hardening: each claim gets a non-reusable lease token.
alter table app.support_email_dfp_outbox add column if not exists lease_token uuid;
alter table app.support_email_dfp_outbox add column if not exists dead_at timestamptz;
alter table app.support_email_dfp_outbox drop constraint if exists support_email_dfp_outbox_status_check;
alter table app.support_email_dfp_outbox add constraint support_email_dfp_outbox_status_check
 check (status in ('pending','processing','delivered','failed','dead'));

-- PostgreSQL cannot replace a function with a different OUT/RETURNS TABLE signature.
-- Worker is not deployed; change the signature atomically in this migration.
drop function if exists app.claim_due_support_email_dfp(integer);
create or replace function app.claim_due_support_email_dfp(p_limit integer default 5)
returns table(id uuid, inbound_email_id uuid, attempt_count integer, lease_token uuid)
language plpgsql security definer set search_path='' as $$
begin
 return query with due as (
 select q.id from app.support_email_dfp_outbox q
 where ((q.status in ('pending','failed') and q.next_attempt_at<=now())
 or (q.status='processing' and q.lease_until<now()))
 and q.attempt_count < 8
 order by q.next_attempt_at,q.created_at
 limit least(greatest(p_limit,1),10) for update skip locked
 )
 update app.support_email_dfp_outbox q set status='processing',
 attempt_count=q.attempt_count+1, lease_until=now()+interval '2 minutes',
 lease_token=gen_random_uuid() from due where q.id=due.id
 returning q.id,q.inbound_email_id,q.attempt_count,q.lease_token;
end $$;
revoke all on function app.claim_due_support_email_dfp(integer) from public,anon,authenticated;
grant execute on function app.claim_due_support_email_dfp(integer) to service_role;

create or replace function app.finish_support_email_dfp(
 p_id uuid,p_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update app.support_email_dfp_outbox q set
 status=case when p_success then 'delivered' when q.attempt_count>=8 then 'dead' else 'failed' end,
 delivered_at=case when p_success then now() else q.delivered_at end,
 dead_at=case when not p_success and q.attempt_count>=8 then now() else q.dead_at end,
 last_error=case when p_success then null else left(coalesce(p_error,'Delivery failed'),120) end,
 lease_until=null,lease_token=null,
 next_attempt_at=case when p_success then q.next_attempt_at else
 now()+(least(3600,power(2,least(q.attempt_count,10))*30)*interval '1 second') end
 where q.id=p_id and q.lease_token=p_token and q.status='processing' and q.lease_until>now();
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function app.finish_support_email_dfp(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function app.finish_support_email_dfp(uuid,uuid,boolean,text) to service_role;
