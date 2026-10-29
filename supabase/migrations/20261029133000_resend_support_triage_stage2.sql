-- Stage 2: reviewed attachment of an inbound email to an existing support ticket.
-- Service-role-only RPC. Never use the email sender or a subject reference as authorisation.
-- The first ticket message is INTERNAL; publishing to a customer requires separate verification.
create or replace function app.triage_quickguard_support_email(
  p_inbound_id uuid,
  p_ticket_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mail app.support_inbound_emails%rowtype;
  v_message_id uuid;
begin
  if p_inbound_id is null or p_ticket_id is null then
    raise exception 'Email and ticket are required';
  end if;
  select * into v_mail
    from app.support_inbound_emails
    where id = p_inbound_id for update;
  if not found then raise exception 'Inbound email not found'; end if;
  if v_mail.status = 'linked' and v_mail.ticket_id = p_ticket_id then
    select id into v_message_id from app.ticket_messages
      where inbound_support_email_id = p_inbound_id;
    return v_message_id;
  end if;
  if v_mail.status <> 'pending_review' then
    raise exception 'Email is already processed';
  end if;
  perform 1 from app.support_tickets
    where id = p_ticket_id and is_deleted = false;
  if not found then raise exception 'Ticket not found'; end if;
  if coalesce(btrim(v_mail.body_text), '') = '' then
    raise exception 'Email has no plain text for review';
  end if;
  insert into app.ticket_messages (
    ticket_id, sender_id, sender_type, sender_name, message_text,
    is_internal, inbound_support_email_id
  ) values (
    p_ticket_id, null, 'admin', 'Inbound email (pending verification)',
    'From: ' || v_mail.sender_email || E'\nSubject: ' || v_mail.subject ||
      E'\n\n' || v_mail.body_text,
    true, p_inbound_id
  ) returning id into v_message_id;
  update app.support_inbound_emails
    set ticket_id = p_ticket_id, status = 'linked'
    where id = p_inbound_id;
  return v_message_id;
end;
$$;
alter table app.ticket_messages add column if not exists inbound_support_email_id uuid
  references app.support_inbound_emails(id) on delete set null;
create unique index if not exists ticket_messages_inbound_support_email_id_key
  on app.ticket_messages(inbound_support_email_id)
  where inbound_support_email_id is not null;
revoke all on function app.triage_quickguard_support_email(uuid,uuid) from public, anon, authenticated;
grant execute on function app.triage_quickguard_support_email(uuid,uuid) to service_role;
