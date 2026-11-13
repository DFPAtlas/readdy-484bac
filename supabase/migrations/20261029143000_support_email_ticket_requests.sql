-- Phase 3 groundwork: approval state for inbound email-to-ticket processing.
-- A staged email can only enter the queue AFTER independent identity verification.
-- No automatic worker is deployed or scheduled by this migration.
create table if not exists app.support_email_ticket_requests (
 id uuid primary key default gen_random_uuid(),
 inbound_email_id uuid not null unique references app.support_inbound_emails(id) on delete restrict,
 actor_kind text not null check (actor_kind in ('client','guard')),
 actor_id uuid not null,
 verification_method text not null check (verification_method in ('authenticated_session','verified_challenge')),
 verification_evidence_id text not null,
 subject text not null,
 body_text text not null,
 status text not null default 'held' check (status in ('held','approved','processing','completed','failed','rejected')),
 created_ticket_id uuid unique references app.support_tickets(id) on delete set null,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (length(subject) between 1 and 500),
 check (length(body_text) between 1 and 20000),
 check (length(verification_evidence_id) between 1 and 250)
);
create index if not exists support_email_ticket_requests_status_idx
 on app.support_email_ticket_requests(status,created_at);
alter table app.support_email_ticket_requests enable row level security;
revoke all on app.support_email_ticket_requests from public, anon, authenticated;
-- Actor references are polymorphic: the future worker MUST verify actor_id
-- exists in app.clients or app.guards and lock both request and staged mail.
-- Do not move status to approved based merely on a matching sender address.
