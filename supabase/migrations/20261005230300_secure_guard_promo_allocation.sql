-- Finding 9: assign-guard-promo-tier was publicly callable (verify_jwt = false, no
-- internal auth) and wrote promotional fields for any caller-supplied guard id with
-- the service-role key. It also: did not check eligibility; allocated signup numbers
-- by counting rows (racy, duplicates possible); read data.length from a head-only
-- count (always 1); ignored write errors in the paused branch; ran the
-- missing-config and paused branches BEFORE the existing-assignment check, so a
-- repeat call could strip an existing founding guard's benefits; and reported
-- success for zero affected rows.
--
-- Allocation now happens in one service-role-only database function that is
-- serialised, idempotent, eligibility-checked, uses database dates, never
-- overwrites an existing allocation, and fails closed on missing configuration.

-- Signup numbers are unique (verified: no duplicates exist today).
create unique index if not exists guards_signup_number_unique on app.guards(signup_number) where signup_number is not null;

create or replace function app.assign_guard_promo_tier(p_guard_id uuid)
returns jsonb language plpgsql security definer set search_path = app, pg_catalog as $$
declare
  v_guard record;
  v_config record;
  v_signup int;
  v_tier text := 'standard';
  v_promo_ends timestamptz := null;
  v_lifetime numeric := null;
  v_founding boolean := false;
  v_rows int;
begin
  if p_guard_id is null then raise exception 'qg_promo:invalid_request'; end if;

  -- One allocation at a time across the platform: numbers are gap-free and unique.
  perform pg_advisory_xact_lock(hashtextextended('guard_promo_allocation', 0));

  select g.id, g.user_id, g.signup_number, g.promo_tier, g.verification_status, g.is_active, g.created_at,
         g.lifetime_fee_percentage, g.founding_badge, g.promo_ends_at
    into v_guard from app.guards g where g.id = p_guard_id for update;
  if v_guard.id is null then raise exception 'qg_promo:guard_not_found'; end if;

  -- Idempotent: an existing allocation (and any founding benefits) is preserved.
  if v_guard.signup_number is not null then
    return jsonb_build_object('success', true, 'alreadyAssigned', true, 'signupNumber', v_guard.signup_number,
      'tier', v_guard.promo_tier, 'lifetimeFee', v_guard.lifetime_fee_percentage,
      'foundingBadge', coalesce(v_guard.founding_badge, false), 'promoEndsAt', v_guard.promo_ends_at, 'newlyAssigned', false);
  end if;

  if coalesce(v_guard.verification_status, '') not in ('approved', 'verified') or not coalesce(v_guard.is_active, false) then
    raise exception 'qg_promo:guard_not_eligible';
  end if;

  select * into v_config from app.promo_config where id = 1;
  if v_config.id is null then
    -- Fail closed: no allocation without configuration; safe to retry later.
    raise exception 'qg_promo:config_missing';
  end if;

  select coalesce(max(signup_number), 0) + 1 into v_signup from app.guards where signup_number is not null;

  if not coalesce(v_config.is_paused, false) then
    if v_config.tier1_cap is not null and v_signup <= v_config.tier1_cap then
      v_tier := 'founding'; v_promo_ends := now() + interval '12 months'; v_lifetime := v_config.tier1_lifetime_fee; v_founding := true;
    elsif v_config.tier2_cap is not null and v_signup <= v_config.tier2_cap then
      v_tier := 'early'; v_promo_ends := now() + interval '6 months';
    elsif v_config.tier3_cap is not null and v_signup <= v_config.tier3_cap
          and v_config.launch_date is not null
          and now() <= v_config.launch_date + make_interval(days => coalesce(v_config.tier3_window_days, 0)) then
      v_tier := 'launch'; v_promo_ends := now() + interval '3 months';
    end if;
  end if;

  update app.guards
     set signup_number = v_signup,
         promo_tier = v_tier,
         promo_starts_at = now(),
         promo_ends_at = v_promo_ends,
         lifetime_fee_percentage = v_lifetime,
         founding_badge = v_founding,
         updated_at = now()
   where id = p_guard_id and signup_number is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'qg_promo:write_conflict'; end if;

  return jsonb_build_object('success', true, 'alreadyAssigned', false, 'newlyAssigned', true, 'signupNumber', v_signup,
    'tier', v_tier, 'promoEndsAt', v_promo_ends, 'lifetimeFee', v_lifetime, 'foundingBadge', v_founding,
    'paused', coalesce(v_config.is_paused, false));
end;
$$;

revoke all on function app.assign_guard_promo_tier(uuid) from public, anon, authenticated;
grant execute on function app.assign_guard_promo_tier(uuid) to service_role;
