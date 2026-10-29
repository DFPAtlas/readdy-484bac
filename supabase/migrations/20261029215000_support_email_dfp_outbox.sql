-- Independent delivery outbox; does not change existing human-review status.
create table if not exists app.support_email_dfp_outbox (
 id uuid primary key default gen_random_uuid(),
 inbound_email_id uuid not null unique references app.support_inbound_emails(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','delivered','failed')),
 attempt_count integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 last_error text,
 delivered_at timestamptz,
 created_at timestamptz not null default now()
);
alter table app.support_email_dfp_outbox enable row level security;
revoke all on app.support_email_dfp_outbox from public,anon,authenticated;
create index if not exists support_email_dfp_due_idx on app.support_email_dfp_outbox(status,next_attempt_at);
-- Enqueue idempotently. A trusted scheduler invokes this separately.
create or replace function app.enqueue_pending_support_email_dfp()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into app.support_email_dfp_outbox(inbound_email_id)
 select id from app.support_inbound_emails where status='pending_review'
 on conflict(inbound_email_id) do nothing;
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function app.enqueue_pending_support_email_dfp() from public,anon,authenticated;
grant execute on function app.enqueue_pending_support_email_dfp() to service_role;

-- Atomic claim with SKIP LOCKED and stale-lease recovery.
create or replace function app.claim_due_support_email_dfp(p_limit integer default 5)
returns table(id uuid, inbound_email_id uuid, attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
 return query
 with claim as (
   select q.id from app.support_email_dfp_outbox q
   where ((q.status in ('pending','failed') and q.next_attempt_at <= now())
      or (q.status = 'processing' and q.lease_until < now()))
   order by q.next_attempt_at, q.created_at
   limit least(greatest(p_limit,1),10) for update skip locked
 )
 update app.support_email_dfp_outbox q
 set status='processing', attempt_count=q.attempt_count+1, lease_until=now()+interval '2 minutes'
 from claim where q.id=claim.id
 returning q.id,q.inbound_email_id,q.attempt_count;
end $$;
revoke all on function app.claim_due_support_email_dfp(integer) from public,anon,authenticated;
grant execute on function app.claim_due_support_email_dfp(integer) to service_role;
