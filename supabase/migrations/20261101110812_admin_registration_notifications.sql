-- Only new profile INSERTs notify; ordinary logins/profile UPDATEs do not.
-- No historical backfill. The existing worker sends after commit, with retries.
begin;
create unique index if not exists uq_email_queue_admin_registration
on app.email_queue (dedupe_key) where email_type = 'admin_registration';

create or replace function app.queue_admin_registration_email()
returns trigger language plpgsql security definer
set search_path = ''
as $function$
declare
  profile jsonb := to_jsonb(new);
  account_role text := case when tg_table_name = 'guards' then 'guard' else 'client' end;
  source_key text;
  applicant_name text;
  applicant_email text;
  submitted_at text;
  review_link text;
  body text;
begin
  source_key := account_role || ':' || coalesce(profile->>'user_id', profile->>'id');
  applicant_name := coalesce(nullif(trim(concat_ws(' ', profile->>'first_name', profile->>'last_name')), ''), nullif(profile->>'full_name', ''), nullif(profile->>'contact_name', ''), 'Not supplied');
  applicant_email := coalesce(profile->>'email', 'Not supplied');
  submitted_at := to_char(coalesce((profile->>'created_at')::timestamptz, now()) at time zone 'Europe/London', 'DD Mon YYYY HH24:MI') || ' (UK time)';
  -- Escape applicant-controlled values before placing them into HTML.
  applicant_name := replace(replace(replace(applicant_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  applicant_email := replace(replace(replace(applicant_email, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  review_link := 'https://quickguard.uk/admin/accounts?role=' || account_role || '&amp;id=' || new.id::text;
  body := '<h1>New QuickGuard ' || account_role || ' application</h1><p>Name: ' || applicant_name || '</p><p>Email: ' || applicant_email || '</p><p>Account type: ' || account_role || '</p><p>Submitted: ' || submitted_at || '</p>';
  if account_role = 'guard' then
    body := body || '<p>SIA verified at registration: ' || case when coalesce((profile->>'sia_verified')::boolean, false) then 'Yes' else 'No' end || '</p>';
  end if;
  body := body || '<p><a href="' || review_link || '">Review application</a></p><p>Administrator sign-in and MFA are required. Documents remain in QuickGuard.</p>';

  insert into app.email_queue
    (user_id, email_type, recipient_email, recipient_name, subject, body_html, status, priority, metadata, dedupe_key, created_at, updated_at)
  values
    (new.user_id, 'admin_registration', 'martin.s.hewett@outlook.com', 'Martin Hewett',
     'QuickGuard — New ' || account_role || ' application', body, 'pending', 5,
     jsonb_build_object('source_record_id', source_key, 'account_role', account_role, 'profile_id', new.id), source_key, now(), now())
  on conflict do nothing;
  return new;
end;
$function$;
-- Trigger-only privilege elevation is required to write the private queue from
-- social profile creation. No browser-callable RPC is exposed.
revoke all on function app.queue_admin_registration_email() from public, anon, authenticated;
drop trigger if exists trg_admin_registration_email on app.guards;
create trigger trg_admin_registration_email after insert on app.guards
for each row execute function app.queue_admin_registration_email();
drop trigger if exists trg_admin_registration_email on app.clients;
create trigger trg_admin_registration_email after insert on app.clients
for each row execute function app.queue_admin_registration_email();
commit;
