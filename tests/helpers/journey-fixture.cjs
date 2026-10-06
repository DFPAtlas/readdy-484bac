// Shared fixture for the journey-repair database tests (PGlite and the real-Postgres concurrency check).
const fs = require('node:fs');
const CLIENT_USER = '11111111-1111-4111-8111-111111111111';
const CLIENT = '22222222-2222-4222-8222-222222222222';
const JOB = '33333333-3333-4333-8333-333333333333';
const GUARD_USER = '44444444-4444-4444-8444-444444444444';
const GUARD = '55555555-5555-4555-8555-555555555555';
const OTHER_USER = '66666666-6666-4666-8666-666666666666';
const OTHER_GUARD = '77777777-7777-4777-8777-777777777777';
const INVITE = '88888888-8888-4888-8888-888888888888';


const MIGRATIONS = ['20261005230000_scheduled_hours_pricing.sql', '20261005230100_enforce_job_post_limits.sql',
  '20261005230200_authoritative_job_applications.sql', '20261005230300_secure_guard_promo_allocation.sql',
  '20261005230400_revoke_browser_usage_rpc.sql'];
function setupSql() {
  return `
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema app; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema app, auth to anon, authenticated, service_role;

    create table app.clients(id uuid primary key, user_id uuid, created_at timestamptz default now());
    create table app.guards(id uuid primary key, user_id uuid, is_active boolean default true, profile_completed boolean default true,
      verification_status varchar default 'approved', sia_verified boolean default true, sia_licence_number varchar default 'SIA1',
      sia_expiry_date date default (current_date + 365), licence_types text[] default array['Door Supervision'], hourly_rate numeric,
      created_at timestamptz default now(), signup_number int, promo_tier text, promo_starts_at timestamptz, promo_ends_at timestamptz,
      lifetime_fee_percentage numeric, founding_badge boolean, updated_at timestamptz);
    create table app.jobs(id uuid primary key default gen_random_uuid(), client_id uuid, job_title text default 'UAT', status text default 'open',
      payment_status text default 'pending', is_deleted boolean default false, start_date date, end_date date, start_time time, end_time time,
      number_of_days int, number_of_guards int default 1, hourly_rate numeric, currency text default 'GBP', sia_licence_required boolean default false,
      required_licence_types text[], job_access_level text, updated_at timestamptz);
    create table app.job_applications(id uuid primary key default gen_random_uuid(), job_id uuid, guard_id uuid, status text, cover_message text,
      cover_letter text, applied_at timestamptz, reviewed_at timestamptz, updated_at timestamptz, unique(job_id, guard_id));
    create table app.job_assignments(id uuid primary key default gen_random_uuid(), job_id uuid, guard_id uuid, status text, payment_status text,
      assigned_at timestamptz, agreed_hourly_rate numeric, agreed_hours numeric, gross_guard_amount numeric, currency text,
      client_total_amount numeric, guard_net_payout numeric, unique(job_id, guard_id));
    create table app.job_invites(id uuid primary key, job_id uuid, guard_id uuid, client_id uuid, status text, responded_at timestamptz);
    create table app.saved_jobs(id uuid primary key default gen_random_uuid(), job_id uuid, guard_id uuid);
    -- Live trigger that expects an updated_at column these tables lacked.
    create function public.update_updated_at_column() returns trigger language plpgsql as $$begin new.updated_at = now(); return new; end$$;
    create trigger trg_app_job_invites_updated_at before update on app.job_invites for each row execute function public.update_updated_at_column();
    create trigger trg_app_saved_jobs_updated_at before update on app.saved_jobs for each row execute function public.update_updated_at_column();
    create table app.user_entitlements(user_id uuid primary key, plan_slug text);
    create table app.plans(slug text primary key, job_limit_per_month int);
    create table app.user_feature_usage(user_id uuid, feature_key text, usage_count int, primary key(user_id, feature_key));
    create table app.promo_config(id int primary key, launch_date timestamptz, tier1_cap int, tier2_cap int, tier3_cap int, tier3_window_days int,
      tier1_lifetime_fee numeric, is_paused boolean);
    grant select, insert, update on all tables in schema app to authenticated;
    grant all on all tables in schema app to service_role;

    -- Test double for the live app.check_monthly_usage (same contract: optional
    -- increment, allowed = usage <= plan limit, unlimited when limit is null).
    create function app.check_monthly_usage(p_user_id uuid, p_feature_key text, p_increment boolean default false)
    returns jsonb language plpgsql security definer set search_path = app as $$
    declare v_plan text; v_limit int; v_used int;
    begin
      select plan_slug into v_plan from app.user_entitlements where user_id = p_user_id;
      if v_plan is null then return jsonb_build_object('allowed', false, 'reason', 'no_entitlement'); end if;
      select job_limit_per_month into v_limit from app.plans where slug = v_plan;
      if v_limit is null then return jsonb_build_object('allowed', true, 'reason', 'unlimited', 'limit', null); end if;
      if p_increment then
        insert into app.user_feature_usage values (p_user_id, p_feature_key, 1)
        on conflict (user_id, feature_key) do update set usage_count = user_feature_usage.usage_count + 1;
      end if;
      select coalesce(usage_count, 0) into v_used from app.user_feature_usage where user_id = p_user_id and feature_key = p_feature_key;
      v_used := coalesce(v_used, 0);
      return jsonb_build_object('allowed', v_used <= v_limit, 'reason', 'ok', 'limit', v_limit, 'used', v_used, 'plan_slug', v_plan);
    end $$;
    grant execute on function app.check_monthly_usage(uuid, text, boolean) to anon, authenticated, service_role;

    insert into app.clients values ('${CLIENT}', '${CLIENT_USER}');
    insert into app.guards(id, user_id, hourly_rate) values ('${GUARD}', '${GUARD_USER}', 20), ('${OTHER_GUARD}', '${OTHER_USER}', null);
    insert into app.plans values ('client_free', 2), ('guard_starter', 1), ('guard-pro', null);
    insert into app.user_entitlements values ('${CLIENT_USER}', 'client_free'), ('${GUARD_USER}', 'guard_starter'), ('${OTHER_USER}', 'guard-pro');
    insert into app.jobs(id, client_id, start_date, end_date, start_time, end_time, number_of_days, hourly_rate)
      values ('${JOB}', '${CLIENT}', '2026-11-02', '2026-11-03', '09:00', '17:00', 2, 18);
`;
}
function migrationSql(name) { return fs.readFileSync(`supabase/migrations/${name}`, 'utf8'); }
module.exports = { CLIENT_USER, CLIENT, JOB, GUARD_USER, GUARD, OTHER_USER, OTHER_GUARD, INVITE, MIGRATIONS, setupSql, migrationSql };
