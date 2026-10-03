-- Delegated worker jobs must still satisfy email_queue required fields.

create or replace function app.queue_cancellation_email()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'app', 'public'
as $function$
declare
  recipient text;
  recipient_user uuid;
begin
  select u.email, u.id into recipient, recipient_user
  from app.jobs j
  join app.clients c on c.id = j.client_id
  join app.users u on u.id = c.user_id
  where j.id = new.job_id;

  if nullif(trim(recipient), '') is null then
    raise warning 'Cannot queue cancellation notification: job client has no email';
    return new;
  end if;

  insert into app.email_queue
    (user_id, email_type, recipient_email, subject, body_html, status, metadata, created_at, updated_at)
  values
    (recipient_user, 'cancellation_notification', recipient,
     'QuickGuard — Cancellation update',
     '<p>Your QuickGuard booking has an update. Sign in to view its current status.</p>',
     'pending',
     jsonb_build_object('cancellation_id', new.id, 'job_id', new.job_id),
     now(), now());
  return new;
end;
$function$;
revoke all on function app.queue_cancellation_email() from public, anon, authenticated;

create or replace function app.queue_refund_email()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'app', 'public'
as $function$
declare
  recipient text;
  recipient_user uuid;
begin
  select u.email, u.id into recipient, recipient_user
  from app.jobs j
  join app.clients c on c.id = j.client_id
  join app.users u on u.id = c.user_id
  where j.id = new.job_id;

  if nullif(trim(recipient), '') is null then
    raise warning 'Cannot queue refund notification: job client has no email';
    return new;
  end if;

  insert into app.email_queue
    (user_id, email_type, recipient_email, subject, body_html, status, metadata, created_at, updated_at)
  values
    (recipient_user, 'refund_notification', recipient,
     'QuickGuard — Refund update',
     '<p>Your QuickGuard booking has an update. Sign in to view its current status.</p>',
     'pending',
     jsonb_build_object('refund_request_id', new.id, 'job_id', new.job_id),
     now(), now());
  return new;
end;
$function$;
revoke all on function app.queue_refund_email() from public, anon, authenticated;
