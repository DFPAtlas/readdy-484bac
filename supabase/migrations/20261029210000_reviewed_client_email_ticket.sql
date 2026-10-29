-- Phase 3A: explicitly reviewed client-email -> private support ticket.
-- Never expose as an end-user RPC. Transaction locks staged mail to prevent duplicate tickets.
alter table app.support_tickets add column if not exists inbound_support_email_id uuid
  references app.support_inbound_emails(id) on delete set null;
create unique index if not exists support_tickets_inbound_support_email_unique
  on app.support_tickets(inbound_support_email_id)
  where inbound_support_email_id is not null;

create or replace function app.create_reviewed_inbound_client_ticket(
  p_inbound_id uuid, p_client_id uuid, p_admin_user_id uuid
) returns table(ticket_id uuid, ticket_reference text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_mail app.support_inbound_emails%rowtype;
  v_ticket_id uuid;
  v_ref text;
  v_client_email text;
begin
  if p_inbound_id is null or p_client_id is null or p_admin_user_id is null then
    raise exception 'Missing review parameters';
  end if;
  if not exists(select 1 from app.admin_users
      where user_id=p_admin_user_id and is_active=true and role in ('admin','super_admin')) then
    raise exception 'Admin validation failed';
  end if;
  select * into v_mail from app.support_inbound_emails
    where id=p_inbound_id for update;
  if not found then raise exception 'Inbound email not found'; end if;
  if v_mail.status='linked' then
    select id, support_tickets.ticket_reference into v_ticket_id,v_ref
      from app.support_tickets where inbound_support_email_id=p_inbound_id;
    if v_ticket_id is not null then
      ticket_id:=v_ticket_id; ticket_reference:=v_ref; return next; return;
    end if;
  end if;
  if v_mail.status <> 'pending_review' then raise exception 'Email already processed'; end if;
  select lower(trim(email)) into v_client_email from app.clients where id=p_client_id;
  if v_client_email is null or v_client_email <> lower(trim(v_mail.sender_email)) then
    raise exception 'Sender does not match client; manual escalation required';
  end if;
  if nullif(trim(v_mail.body_text),'') is null then raise exception 'Empty email body'; end if;
  insert into app.support_tickets
    (client_id,category,subject,description,status,priority,inbound_support_email_id)
  values (p_client_id,'general_support',coalesce(nullif(left(v_mail.subject,500),''),'Support email'),
    left(v_mail.body_text,20000),'open','normal',p_inbound_id)
  returning id, support_tickets.ticket_reference into v_ticket_id,v_ref;
  insert into app.ticket_messages
    (ticket_id,sender_id,sender_type,sender_name,message_text,is_internal,inbound_support_email_id)
  values (v_ticket_id,null,'admin','Inbound email (reviewed by admin)',
    'From: ' || v_mail.sender_email || E'\nSubject: ' || coalesce(v_mail.subject,'') ||
      E'\n\n' || v_mail.body_text,true,p_inbound_id);
  update app.support_inbound_emails set status='linked',ticket_id=v_ticket_id where id=p_inbound_id;
  ticket_id:=v_ticket_id; ticket_reference:=v_ref; return next;
end $$;
revoke all on function app.create_reviewed_inbound_client_ticket(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app.create_reviewed_inbound_client_ticket(uuid,uuid,uuid) to service_role;
