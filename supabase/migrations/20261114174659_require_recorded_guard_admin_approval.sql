-- Apply after the updated admin approval function is available and legacy approvals are confirmed.
SET LOCAL lock_timeout = '500ms';

CREATE FUNCTION app.guard_has_current_sia(
  verified boolean, licence_number text, expiry date, check_date date
)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO ''
AS $predicate$
  SELECT coalesce(verified, false)
    AND nullif(btrim(licence_number), '') IS NOT NULL
    AND expiry IS NOT NULL AND expiry >= check_date;
$predicate$;

CREATE FUNCTION app.record_guard_admin_approval()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO ''
AS $trigger$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF app.is_active_admin() AND TG_OP = 'UPDATE'
      AND NEW.verification_status IN ('approved', 'verified') THEN
      NEW.verified_by := coalesce(OLD.verified_by, auth.uid());
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.verified_by IS NOT NULL OR NEW.verification_status IN ('approved', 'verified') THEN
        RAISE EXCEPTION 'Guard approval requires an active admin with MFA' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.verified_by IS DISTINCT FROM OLD.verified_by THEN
      RAISE EXCEPTION 'Guard reviewer cannot be changed' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.verification_status = 'rejected' THEN
    NEW.verified_by := NULL;
  ELSIF NEW.verification_status IN ('approved', 'verified') AND NEW.verified_by IS NULL THEN
    NEW.verification_status := 'manual_review';
    NEW.is_active := false;
    NEW.dashboard_access := false;
    NEW.verified_at := NULL;
  END IF;

  RETURN NEW;
END
$trigger$;

CREATE TRIGGER trg_record_guard_admin_approval
  BEFORE INSERT OR UPDATE OF verification_status, verified_by ON app.guards
  FOR EACH ROW EXECUTE FUNCTION app.record_guard_admin_approval();

CREATE OR REPLACE FUNCTION app.protect_guard_server_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.role() = 'authenticated' AND NOT is_active_admin() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
      OR (OLD.verified_by IS NOT NULL AND (
        NEW.sia_licence_number IS DISTINCT FROM OLD.sia_licence_number
        OR NEW.licence_types IS DISTINCT FROM OLD.licence_types
      ))
      OR NEW.sia_verified IS DISTINCT FROM OLD.sia_verified
      OR NEW.sia_verified_at IS DISTINCT FROM OLD.sia_verified_at
      OR NEW.sia_check_status IS DISTINCT FROM OLD.sia_check_status
      OR NEW.sia_checked_at IS DISTINCT FROM OLD.sia_checked_at
      OR NEW.sia_scraped_name IS DISTINCT FROM OLD.sia_scraped_name
      OR NEW.sia_scraped_licence_type IS DISTINCT FROM OLD.sia_scraped_licence_type
      OR NEW.sia_scraped_status IS DISTINCT FROM OLD.sia_scraped_status
      OR NEW.sia_scraped_expiry_date IS DISTINCT FROM OLD.sia_scraped_expiry_date
      OR NEW.sia_confidence_score IS DISTINCT FROM OLD.sia_confidence_score
      OR NEW.sia_mismatch_reason IS DISTINCT FROM OLD.sia_mismatch_reason
      OR NEW.sia_raw_result_json IS DISTINCT FROM OLD.sia_raw_result_json
      OR NEW.sia_verification_details IS DISTINCT FROM OLD.sia_verification_details
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.dashboard_access IS DISTINCT FROM OLD.dashboard_access
      OR NEW.profile_completed IS DISTINCT FROM OLD.profile_completed
      OR NEW.total_jobs_completed IS DISTINCT FROM OLD.total_jobs_completed
      OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
      OR NEW.rating IS DISTINCT FROM OLD.rating
      OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews
      OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
      OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
      OR NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id
      OR NEW.stripe_account_status IS DISTINCT FROM OLD.stripe_account_status
      OR NEW.stripe_connect_status IS DISTINCT FROM OLD.stripe_connect_status
      OR NEW.stripe_connect_restricted_reason IS DISTINCT FROM OLD.stripe_connect_restricted_reason
      OR NEW.stripe_connect_onboarded_at IS DISTINCT FROM OLD.stripe_connect_onboarded_at
      OR NEW.stripe_connect_verified_at IS DISTINCT FROM OLD.stripe_connect_verified_at
      OR NEW.stripe_details_submitted IS DISTINCT FROM OLD.stripe_details_submitted
      OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
      OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
      OR NEW.stripe_requirements_due IS DISTINCT FROM OLD.stripe_requirements_due
      OR NEW.stripe_last_checked_at IS DISTINCT FROM OLD.stripe_last_checked_at
      OR NEW.bank_account_verified IS DISTINCT FROM OLD.bank_account_verified
      OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
      OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
      OR NEW.plan_slug IS DISTINCT FROM OLD.plan_slug
      OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
      OR NEW.promo_tier IS DISTINCT FROM OLD.promo_tier
      OR NEW.promo_starts_at IS DISTINCT FROM OLD.promo_starts_at
      OR NEW.promo_ends_at IS DISTINCT FROM OLD.promo_ends_at
      OR NEW.lifetime_fee_percentage IS DISTINCT FROM OLD.lifetime_fee_percentage
      OR NEW.founding_badge IS DISTINCT FROM OLD.founding_badge
      OR NEW.signup_number IS DISTINCT FROM OLD.signup_number
    THEN
      RAISE EXCEPTION 'Attempt to modify protected guard fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION app.submit_job_application(p_actor_user_id uuid, p_guard_id uuid, p_job_id uuid, p_cover_message text DEFAULT NULL::text, p_invite_id uuid DEFAULT NULL::uuid, p_is_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'pg_catalog'
AS $function$
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

  if not coalesce(v_guard.is_active, false) then raise exception 'qg_apply:guard_inactive'; end if;
  if v_guard.verified_by is null or coalesce(v_guard.verification_status, '') not in ('verified', 'approved') then
    raise exception 'qg_apply:guard_not_verified';
  end if;
  if v_guard.sia_expiry_date < current_date then raise exception 'qg_apply:sia_expired'; end if;
  if coalesce(v_job.sia_licence_required, false)
    and not app.guard_has_current_sia(v_guard.sia_verified, v_guard.sia_licence_number, v_guard.sia_expiry_date, current_date) then
    raise exception 'qg_apply:sia_required';
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
$function$;

CREATE OR REPLACE FUNCTION app.select_job_guards(p_job_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id uuid;
  v_job record;
  v_sel jsonb;
  v_guard_id uuid;
  v_app record;
  v_guard record;
  v_existing int;
  v_selected_count int := 0;
  v_required_licence_types text[];
  v_licence_match boolean;
  v_licence text;
  v_sia_required boolean;
  v_req_licence text;
  v_hours numeric;
  v_rate numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT c.id INTO v_client_id FROM app.clients c WHERE c.user_id = v_uid LIMIT 1;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;

  SELECT * INTO v_job FROM app.jobs
  WHERE id = p_job_id AND client_id = v_client_id AND COALESCE(is_deleted, false) = false
  FOR UPDATE;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job_not_owned';
  END IF;

  IF v_job.payment_status IN ('paid', 'funded', 'succeeded', 'complete', 'completed', 'held') THEN
    RAISE EXCEPTION 'job_already_paid';
  END IF;

  IF jsonb_typeof(p_selections) IS NULL OR jsonb_typeof(p_selections) <> 'array' THEN
    RAISE EXCEPTION 'invalid_selections';
  END IF;

  -- Authoritative payable hours per guard (daily shift hours x days).
  v_hours := app.job_scheduled_hours(v_job.start_time, v_job.end_time, v_job.number_of_days, v_job.start_date, v_job.end_date);
  IF v_hours IS NULL OR v_hours <= 0 THEN
    RAISE EXCEPTION 'invalid_job_schedule';
  END IF;

  v_required_licence_types := COALESCE(v_job.required_licence_types, ARRAY[]::text[]);
  v_sia_required := COALESCE(v_job.sia_licence_required, false);

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_guard_id := (v_sel->>'guard_id')::uuid;
    IF v_guard_id IS NULL THEN
      RAISE EXCEPTION 'invalid_guard_id';
    END IF;

    SELECT * INTO v_app FROM app.job_applications WHERE job_id = p_job_id AND guard_id = v_guard_id;
    IF v_app.id IS NULL THEN
      RAISE EXCEPTION 'not_an_applicant';
    END IF;

    SELECT * INTO v_guard FROM app.guards WHERE id = v_guard_id;
    IF v_guard.id IS NULL THEN RAISE EXCEPTION 'guard_not_found'; END IF;
    IF COALESCE(v_guard.is_active, false) = false THEN RAISE EXCEPTION 'guard_inactive'; END IF;
    IF COALESCE(v_guard.profile_completed, false) = false THEN RAISE EXCEPTION 'guard_profile_incomplete'; END IF;
    IF v_guard.verified_by IS NULL OR COALESCE(v_guard.verification_status, '') NOT IN ('approved', 'verified') THEN
      RAISE EXCEPTION 'guard_not_verified';
    END IF;
    IF v_guard.sia_expiry_date < current_date THEN RAISE EXCEPTION 'guard_sia_expired'; END IF;
    IF v_sia_required AND NOT app.guard_has_current_sia(v_guard.sia_verified, v_guard.sia_licence_number, v_guard.sia_expiry_date, current_date) THEN
      RAISE EXCEPTION 'guard_sia_not_verified';
    END IF;

    IF array_length(v_required_licence_types, 1) > 0 THEN
      v_licence_match := false;
      IF v_guard.licence_types IS NOT NULL THEN
        FOREACH v_licence IN ARRAY v_guard.licence_types LOOP
          FOREACH v_req_licence IN ARRAY v_required_licence_types LOOP
            IF lower(v_licence) LIKE '%' || lower(v_req_licence) || '%'
               OR lower(v_req_licence) LIKE '%' || lower(v_licence) || '%' THEN
              v_licence_match := true; EXIT;
            END IF;
          END LOOP;
          IF v_licence_match THEN EXIT; END IF;
        END LOOP;
      END IF;
      IF NOT v_licence_match THEN RAISE EXCEPTION 'guard_licence_mismatch'; END IF;
    END IF;

    SELECT count(*) INTO v_existing FROM app.job_assignments
    WHERE job_id = p_job_id AND guard_id = v_guard_id
      AND status IN ('confirmed', 'assigned', 'active', 'in_progress', 'completed');
    IF v_existing > 0 THEN RAISE EXCEPTION 'duplicate_assignment'; END IF;

    -- Rate: the guard's own rate when set, otherwise the job rate (matches the
    -- selection screen). Browser-supplied rate, hours and gross are ignored.
    v_rate := COALESCE(NULLIF(v_guard.hourly_rate, 0), v_job.hourly_rate);
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'invalid_hourly_rate'; END IF;

    UPDATE app.job_applications SET status = 'selected', reviewed_at = now(), updated_at = now()
    WHERE job_id = p_job_id AND guard_id = v_guard_id;

    INSERT INTO app.job_assignments (
      job_id, guard_id, status, payment_status, assigned_at,
      agreed_hourly_rate, agreed_hours, gross_guard_amount, currency
    ) VALUES (
      p_job_id, v_guard_id, 'awaiting_payment', 'pending', now(),
      v_rate, v_hours, round(v_rate * v_hours, 2), COALESCE(v_job.currency, 'GBP')
    )
    ON CONFLICT (job_id, guard_id) DO UPDATE
    SET status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        assigned_at = EXCLUDED.assigned_at,
        agreed_hourly_rate = EXCLUDED.agreed_hourly_rate,
        agreed_hours = EXCLUDED.agreed_hours,
        gross_guard_amount = EXCLUDED.gross_guard_amount,
        currency = EXCLUDED.currency;

    v_selected_count := v_selected_count + 1;
  END LOOP;

  IF v_selected_count = 0 THEN RAISE EXCEPTION 'no_selections'; END IF;

  UPDATE app.jobs SET status = 'awaiting_payment', payment_status = 'pending', updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('success', true, 'selected_count', v_selected_count,
    'job_status', 'awaiting_payment', 'payment_status', 'pending', 'agreed_hours', v_hours);
END;
$function$;
-- The payment function checks current eligibility before opening or resuming Stripe Checkout.
CREATE FUNCTION app.checkout_guards_are_eligible(booking_id uuid, assignment_ids uuid[])
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO ''
AS $checkout$
  SELECT cardinality(assignment_ids) > 0
    AND count(*) = cardinality(assignment_ids)
    AND coalesce(bool_and(
      coalesce(guard.is_active, false)
      AND coalesce(guard.profile_completed, false)
      AND coalesce(guard.verification_status IN ('approved', 'verified'), false)
      AND guard.verified_by IS NOT NULL
      AND (guard.sia_expiry_date IS NULL OR guard.sia_expiry_date >= CURRENT_DATE)
      AND (
        NOT coalesce(job.sia_licence_required, false)
        OR app.guard_has_current_sia(guard.sia_verified, guard.sia_licence_number, guard.sia_expiry_date, CURRENT_DATE)
      )
      AND (
        coalesce(cardinality(job.required_licence_types), 0) = 0
        OR EXISTS (
          SELECT 1
          FROM unnest(guard.licence_types) AS held(value)
          CROSS JOIN unnest(job.required_licence_types) AS required(value)
          WHERE lower(held.value) LIKE '%' || lower(required.value) || '%'
             OR lower(required.value) LIKE '%' || lower(held.value) || '%'
        )
      )
    ), false)
  FROM app.job_assignments AS assignment
  JOIN app.jobs AS job ON job.id = assignment.job_id
  JOIN app.guards AS guard ON guard.id = assignment.guard_id
  WHERE assignment.job_id = booking_id
    AND assignment.id = ANY (assignment_ids)
    AND assignment.status IN ('selected', 'awaiting_payment');
$checkout$;

REVOKE ALL ON FUNCTION app.checkout_guards_are_eligible(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.checkout_guards_are_eligible(uuid, uuid[]) TO service_role;
