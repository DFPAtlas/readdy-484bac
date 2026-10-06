-- Findings 3, 4 and 5: guard application entry points.
--
-- * Five screens (dedicated apply page, job detail, saved jobs, mobile dashboard,
--   invitation acceptance) inserted into app.job_applications from the browser
--   instead of calling apply-to-job. app.job_applications has forced RLS with no
--   guard INSERT policy, so those inserts were rejected, and none of the eligibility,
--   tier or usage checks ran on that path.
-- * Invitation acceptance set job_invites.status = 'accepted' before attempting the
--   application, so a failed application left a consumed, non-retryable invite.
-- * apply-to-job incremented usage before inserting, so a failed or duplicate
--   insert still consumed an application, and two concurrent requests could both pass.
-- * app.check_monthly_usage(p_user_id, ..., p_increment) was executable by anon and
--   authenticated with any user id, letting any caller read or consume another
--   account's allowance. Limit helpers also mixed guards.id and auth user ids.
--
-- app.submit_job_application is now the single authoritative path. It resolves the
-- guard's auth user from guards.id itself, serialises per guard, re-checks
-- eligibility, is idempotent for invitations, consumes usage and accepts the
-- invitation in the same transaction as the insert.

-- Live-schema defect found while verifying invitation acceptance: app.job_invites
-- (and app.saved_jobs) carry a BEFORE UPDATE trigger that sets NEW.updated_at, but
-- neither table has that column, so EVERY update (accept, decline, client edits)
-- fails with 'record "new" has no field "updated_at"'. Add the column.
alter table app.job_invites add column if not exists updated_at timestamptz not null default now();
alter table app.saved_jobs add column if not exists updated_at timestamptz not null default now();

create or replace function app.submit_job_application(
  p_actor_user_id uuid,
  p_guard_id uuid,
  p_job_id uuid,
  p_cover_message text default null,
  p_invite_id uuid default null,
  p_is_admin boolean default false
) returns jsonb
language plpgsql security definer set search_path = app, pg_catalog as $$
declare
  v_guard record;
  v_job record;
  v_invite record;
  v_existing uuid;
  v_app_id uuid;
  v_plan text;
  v_usage jsonb;
  v_guard_level int;
  v_job_level int;
begin
  if p_guard_id is null or p_job_id is null then
    raise exception 'qg_apply:invalid_request';
  end if;

  select g.* into v_guard from app.guards g where g.id = p_guard_id;
  if v_guard.id is null then raise exception 'qg_apply:guard_not_found'; end if;
  -- guards.id identifies the profile; guards.user_id is the auth user that owns it.
  if not p_is_admin and v_guard.user_id is distinct from p_actor_user_id then
    raise exception 'qg_apply:forbidden';
  end if;

  -- One application decision per guard at a time (duplicates and limit races).
  perform pg_advisory_xact_lock(hashtextextended('guard_application:' || v_guard.user_id::text, 0));

  if p_invite_id is not null then
    select i.* into v_invite from app.job_invites i where i.id = p_invite_id for update;
    if v_invite.id is null or v_invite.guard_id is distinct from p_guard_id or v_invite.job_id is distinct from p_job_id then
      raise exception 'qg_apply:invite_not_found';
    end if;
    if v_invite.status not in ('pending', 'accepted') then
      raise exception 'qg_apply:invite_not_pending';
    end if;
  end if;

  -- Idempotency: an existing application is never duplicated or charged twice.
  select a.id into v_existing from app.job_applications a where a.job_id = p_job_id and a.guard_id = p_guard_id;
  if v_existing is not null then
    if p_invite_id is not null then
      update app.job_invites set status = 'accepted', responded_at = coalesce(responded_at, now())
      where id = p_invite_id and status <> 'accepted';
      return jsonb_build_object('applicationId', v_existing, 'replayed', true, 'guardUserId', v_guard.user_id, 'inviteAccepted', true);
    end if;
    raise exception 'qg_apply:already_applied';
  end if;

  select j.* into v_job from app.jobs j where j.id = p_job_id;
  if v_job.id is null then raise exception 'qg_apply:job_not_found'; end if;
  if coalesce(v_job.is_deleted, false) then raise exception 'qg_apply:job_removed'; end if;
  if v_job.status is distinct from 'open' then raise exception 'qg_apply:job_closed'; end if;

  if not p_is_admin then
    if not coalesce(v_guard.is_active, false) then raise exception 'qg_apply:guard_inactive'; end if;
    if coalesce(v_guard.verification_status, '') not in ('verified', 'approved') then raise exception 'qg_apply:guard_not_verified'; end if;
    if v_guard.sia_expiry_date is not null and v_guard.sia_expiry_date < current_date then raise exception 'qg_apply:sia_expired'; end if;
    if coalesce(v_job.sia_licence_required, false) then
      if not coalesce(v_guard.sia_verified, false) or coalesce(v_guard.sia_licence_number, '') = '' then raise exception 'qg_apply:sia_required'; end if;
      if v_guard.sia_expiry_date is null then raise exception 'qg_apply:sia_expiry_missing'; end if;
    end if;
  end if;

  if coalesce(v_job.sia_licence_required, false) and coalesce(array_length(v_job.required_licence_types, 1), 0) > 0 then
    if not exists (
      select 1 from unnest(v_job.required_licence_types) r(t), unnest(coalesce(v_guard.licence_types, array[]::text[])) l(t)
      where lower(r.t) = lower(l.t)
    ) then
      raise exception 'qg_apply:licence_mismatch';
    end if;
  end if;

  if not p_is_admin then
    select e.plan_slug into v_plan from app.user_entitlements e where e.user_id = v_guard.user_id;
    if v_plan is null then raise exception 'qg_apply:no_plan'; end if;
    if not exists (select 1 from app.plans p where p.slug = v_plan) then raise exception 'qg_apply:plan_not_found'; end if;

    v_guard_level := case v_plan when 'guard-basic' then 1 when 'guard-pro' then 2 when 'guard-elite' then 3 else 0 end;
    v_job_level := case coalesce(v_job.job_access_level, 'basic') when 'professional' then 1 when 'premium' then 2 when 'elite' then 3 else 0 end;
    if v_guard_level < v_job_level then raise exception 'qg_apply:tier_locked:%', coalesce(v_job.job_access_level, 'basic'); end if;

    -- Check first (never consume when already exhausted), then consume.
    v_usage := app.check_monthly_usage(v_guard.user_id, 'guard_application', false);
    if not coalesce((v_usage->>'allowed')::boolean, false) then
      raise exception 'qg_apply:limit_reached' using detail = v_usage::text;
    end if;
    v_usage := app.check_monthly_usage(v_guard.user_id, 'guard_application', true);
    if not coalesce((v_usage->>'allowed')::boolean, false) then
      raise exception 'qg_apply:limit_reached' using detail = v_usage::text;
    end if;
  end if;

  insert into app.job_applications (job_id, guard_id, cover_message, cover_letter, status, applied_at)
  values (p_job_id, p_guard_id, coalesce(p_cover_message, ''), nullif(p_cover_message, ''), 'pending', now())
  returning id into v_app_id;

  if p_invite_id is not null then
    update app.job_invites set status = 'accepted', responded_at = now() where id = p_invite_id;
  end if;

  return jsonb_build_object('applicationId', v_app_id, 'replayed', false, 'guardUserId', v_guard.user_id,
    'inviteAccepted', p_invite_id is not null, 'usage', v_usage);
end;
$$;

revoke all on function app.submit_job_application(uuid, uuid, uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function app.submit_job_application(uuid, uuid, uuid, text, uuid, boolean) to service_role;

-- Invitations may only become 'accepted' through submit_job_application (which runs
-- as the definer). Guards can still decline directly.
create or replace function app.guard_invite_acceptance_requires_application()
returns trigger language plpgsql set search_path = app, pg_catalog as $$
begin
  if coalesce(nullif(current_setting('role', true), 'none'), '') in ('authenticated', 'anon')
     and new.status = 'accepted' and old.status is distinct from 'accepted' then
    raise exception 'invite_acceptance_requires_application' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $drop$ begin if exists (select 1 from pg_trigger where tgname = 'trg_guard_invite_acceptance_requires_application' and tgrelid = 'app.job_invites'::regclass) then drop trigger trg_guard_invite_acceptance_requires_application on app.job_invites; end if; end $drop$;
create trigger trg_guard_invite_acceptance_requires_application
  before update of status on app.job_invites
  for each row execute function app.guard_invite_acceptance_requires_application();

-- Read-only usage for the signed-in account. No user id parameter, so a guard
-- profile id can never be mistaken for an auth user id.
create or replace function app.get_my_feature_usage(p_feature_key text)
returns jsonb language plpgsql volatile security definer set search_path = app, pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_feature_key not in ('guard_application', 'client_job_post') then raise exception 'invalid_feature_key'; end if;
  return app.check_monthly_usage(auth.uid(), p_feature_key, false);
end;
$$;

revoke all on function app.get_my_feature_usage(text) from public, anon;
grant execute on function app.get_my_feature_usage(text) to authenticated, service_role;

-- NOTE: browser EXECUTE on app.check_monthly_usage is revoked separately in
-- 20261005230400_revoke_browser_usage_rpc.sql, which must be applied only AFTER the
-- frontend that calls get_my_feature_usage has been published from Readdy.
