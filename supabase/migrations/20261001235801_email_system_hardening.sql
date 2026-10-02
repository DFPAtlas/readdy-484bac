-- QuickGuard email system hardening.
-- Keeps the live template schema contract, improves observability, locks the queue down,
-- preserves cancellation/refund trigger writers, and guarantees notification preferences.

alter table app.email_send_log
  add column if not exists provider_message_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='app' and table_name='email_templates' and column_name='template_key'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='app' and table_name='email_templates' and column_name='template_slug'
  ) then
    alter table app.email_templates rename column template_key to template_slug;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='app' and table_name='email_templates' and column_name='html_body'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='app' and table_name='email_templates' and column_name='body_html'
  ) then
    alter table app.email_templates rename column html_body to body_html;
  end if;
end $$;

create or replace function app.queue_cancellation_email()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'app', 'public'
as $function$
begin
  insert into app.email_queue (email_type, status, metadata, created_at, updated_at)
  values (
    'cancellation_notification',
    'pending',
    jsonb_build_object('cancellation_id', new.id, 'job_id', new.job_id, 'cancelled_by', new.cancelled_by),
    now(),
    now()
  );
  return new;
end;
$function$;

create or replace function app.queue_refund_email()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'app', 'public'
as $function$
begin
  insert into app.email_queue (email_type, status, metadata, created_at, updated_at)
  values (
    'refund_notification',
    'pending',
    jsonb_build_object('refund_request_id', new.id, 'job_id', new.job_id, 'status', new.status, 'type', new.type),
    now(),
    now()
  );
  return new;
end;
$function$;

revoke all on function app.queue_cancellation_email() from public, anon, authenticated;
revoke all on function app.queue_refund_email() from public, anon, authenticated;

drop policy if exists "Authenticated can enqueue" on app.email_queue;
drop policy if exists "user_can_update_own" on app.email_queue;
drop policy if exists "user_can_view_own" on app.email_queue;
drop policy if exists "email_queue_admin_select" on app.email_queue;
drop policy if exists "email_queue_admin_insert" on app.email_queue;
drop policy if exists "email_queue_admin_update" on app.email_queue;
drop policy if exists "email_queue_admin_delete" on app.email_queue;

create policy "email_queue_admin_select"
on app.email_queue for select to authenticated
using (app.is_active_admin() and (auth.jwt() ->> 'aal') = 'aal2');

create policy "email_queue_admin_insert"
on app.email_queue for insert to authenticated
with check (app.is_active_admin() and (auth.jwt() ->> 'aal') = 'aal2');

create policy "email_queue_admin_update"
on app.email_queue for update to authenticated
using (app.is_active_admin() and (auth.jwt() ->> 'aal') = 'aal2')
with check (app.is_active_admin() and (auth.jwt() ->> 'aal') = 'aal2');

create policy "email_queue_admin_delete"
on app.email_queue for delete to authenticated
using (app.is_active_admin() and (auth.jwt() ->> 'aal') = 'aal2');

insert into app.notification_preferences (user_id)
select id from app.users
where id is not null
on conflict (user_id) do nothing;

create or replace function app.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'app', 'public'
as $function$
begin
  insert into app.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

revoke all on function app.ensure_notification_preferences() from public, anon, authenticated;

drop trigger if exists trg_ensure_notification_preferences on app.users;
create trigger trg_ensure_notification_preferences
after insert on app.users
for each row execute function app.ensure_notification_preferences();
