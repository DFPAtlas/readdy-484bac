-- Stage 1: safely store and deduplicate verified Resend inbound support messages.
-- Do not write unauthenticated inbound messages directly into customer-visible tickets.
create table if not exists app.support_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  internet_message_id text,
  sender_email text not null,
  recipient_email text not null,
  subject text not null default '',
  body_text text not null default '',
  ticket_id uuid references app.support_tickets(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review','linked','rejected')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists support_inbound_emails_status_idx on app.support_inbound_emails(status,created_at);
alter table app.support_inbound_emails enable row level security;
revoke all on app.support_inbound_emails from anon, authenticated;
-- Service role only; never expose raw inbound email to browser clients.
