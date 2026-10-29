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
