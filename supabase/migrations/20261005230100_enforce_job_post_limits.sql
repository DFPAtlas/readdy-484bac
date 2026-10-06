-- Finding 2: mobile and desktop job posting differ.
-- Desktop posted through the create-job Edge Function (ownership, validation and
-- monthly plan limit), while mobile, bulk posting and templates inserted rows
-- straight into app.jobs and skipped the plan limit entirely. create-job also
-- checked the limit, inserted, then incremented usage in a separate call, so
-- concurrent posts could exceed the limit.
--
-- This trigger makes the monthly posting limit authoritative in the database for
-- every application insert path: it serialises per client, re-checks the limit
-- and consumes one unit of usage inside the same transaction as the insert. A
-- failed insert therefore never consumes usage, and a limit breach aborts the insert.
-- Direct SQL/maintenance inserts (postgres role) are not counted.

create or replace function app.enforce_client_job_post_limit()
returns trigger language plpgsql security definer set search_path = app, pg_catalog as $$
declare
  v_user uuid;
  v_check jsonb;
  -- SECURITY DEFINER changes current_user, so read the API role from the
  -- session's role setting (PostgREST/Supabase sets it per request).
  v_role text := coalesce(nullif(current_setting('role', true), 'none'), '');
begin
  if v_role not in ('authenticated', 'anon', 'service_role') then
    return new;
  end if;

  select c.user_id into v_user from app.clients c where c.id = new.client_id;
  if v_user is null then
    raise exception 'job_post_client_not_found' using errcode = '42501';
  end if;
  -- Browser inserts must belong to the signed-in client (RLS also checks this).
  if v_role <> 'service_role' and v_user is distinct from auth.uid() then
    raise exception 'job_post_not_owner' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('client_job_post:' || v_user::text, 0));

  v_check := app.check_monthly_usage(v_user, 'client_job_post', false);
  if coalesce((v_check->>'allowed')::boolean, false) = false then
    raise exception 'job_post_limit_reached: %', coalesce(v_check->>'reason', 'limit_reached')
      using errcode = 'P0001', detail = v_check::text;
  end if;

  v_check := app.check_monthly_usage(v_user, 'client_job_post', true);
  if coalesce((v_check->>'allowed')::boolean, false) = false then
    raise exception 'job_post_limit_reached: %', coalesce(v_check->>'reason', 'limit_reached')
      using errcode = 'P0001', detail = v_check::text;
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_client_job_post_limit() from public, anon, authenticated;

do $drop$ begin if exists (select 1 from pg_trigger where tgname = 'trg_enforce_client_job_post_limit' and tgrelid = 'app.jobs'::regclass) then drop trigger trg_enforce_client_job_post_limit on app.jobs; end if; end $drop$;
create trigger trg_enforce_client_job_post_limit
  before insert on app.jobs
  for each row execute function app.enforce_client_job_post_limit();
