-- Secure scheduled email worker token and scheduler wiring.
-- Rotates the retired application-status secret, moves the status trigger to the new worker token,
-- adds a queue processor schedule, and repairs daily/weekly digest cron authentication.

do $$
declare
  v_secret text;
  v_old_id uuid;
begin
  if not exists (select 1 from vault.secrets where name = 'qg_email_worker_token') then
    v_secret := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      v_secret,
      'qg_email_worker_token',
      'QuickGuard internal email scheduler/trigger worker token'
    );
  end if;

  select id into v_old_id
  from vault.secrets
  where name = 'qg_application_status_internal_secret'
  limit 1;

  if v_old_id is not null then
    perform vault.update_secret(
      v_old_id,
      encode(extensions.gen_random_bytes(32), 'hex'),
      'qg_application_status_internal_secret',
      'Retired and rotated 2026-10-02; no longer used for application-status delivery'
    );
  end if;
end $$;

create or replace function app.validate_email_worker_token(p_token text)
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select coalesce(
    exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'qg_email_worker_token'
        and s.decrypted_secret = p_token
        and p_token is not null
        and length(p_token) >= 32
    ),
    false
  );
$function$;

revoke all on function app.validate_email_worker_token(text) from public, anon, authenticated;
grant execute on function app.validate_email_worker_token(text) to service_role;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('app.trg_application_status_change()'::regprocedure)
  into v_def;

  if v_def is not null then
    v_def := replace(v_def, 'x-qg-internal-secret', 'x-qg-email-worker-token');
    v_def := replace(v_def, 'qg_application_status_internal_secret', 'qg_email_worker_token');
    execute v_def;
  end if;
end $$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-daily-digest') then
    perform cron.unschedule('send-daily-digest');
  end if;
  if exists (select 1 from cron.job where jobname = 'send-weekly-digest') then
    perform cron.unschedule('send-weekly-digest');
  end if;
  if exists (select 1 from cron.job where jobname = 'process-email-queue') then
    perform cron.unschedule('process-email-queue');
  end if;
end $$;

select cron.schedule(
  'process-email-queue',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/process-email-queue',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-qg-email-worker-token',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='qg_email_worker_token'
          limit 1
        )
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);

select cron.schedule(
  'send-daily-digest',
  '0 8 * * *',
  $cron$
    select net.http_post(
      url := 'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/send-daily-digest',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-qg-email-worker-token',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='qg_email_worker_token'
          limit 1
        )
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);

select cron.schedule(
  'send-weekly-digest',
  '0 8 * * 1',
  $cron$
    select net.http_post(
      url := 'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/send-weekly-digest',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-qg-email-worker-token',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='qg_email_worker_token'
          limit 1
        )
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);
