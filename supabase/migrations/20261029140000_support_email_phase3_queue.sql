-- Phase 3 foundation only. No worker is enabled and no messages are sent.
-- This schema deliberately does not expose a browser-accessible send endpoint.
create table if not exists app.support_outbound_email_queue (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references app.support_tickets(id) on delete cascade,
  ticket_message_id uuid not null references app.ticket_messages(id) on delete cascade,
  recipient_email text not null,
  sender_email text not null default 'support@quickguard.uk',
  subject text not null,
  body_text text not null,
  idempotency_key text not null unique,
  provider_message_id text unique,
  status text not null default 'held' check (status in ('held','queued','sending','sent','failed','suppressed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(recipient_email) <= 254 and char_length(body_text) <= 20000)
);
create index if not exists support_outbound_email_queue_retry_idx
  on app.support_outbound_email_queue (status,next_attempt_at);
alter table app.support_outbound_email_queue enable row level security;
revoke all on app.support_outbound_email_queue from public, anon, authenticated;

create table if not exists app.support_email_audit (
  id uuid primary key default gen_random_uuid(),
  inbound_email_id uuid references app.support_inbound_emails(id) on delete set null,
  ticket_id uuid references app.support_tickets(id) on delete set null,
  actor_id uuid,
  action text not null,
  outcome text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_email_audit_ticket_idx on app.support_email_audit(ticket_id,created_at);
alter table app.support_email_audit enable row level security;
revoke all on app.support_email_audit from public, anon, authenticated;

-- No automatic ticket creation or sending occurs as a result of this migration.
