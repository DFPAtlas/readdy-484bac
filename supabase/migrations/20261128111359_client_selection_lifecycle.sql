-- Fail closed for non-recruiting jobs and inactive applications.
-- Preserve existing ownership, eligibility, pricing and provisional payment rules.
SET LOCAL lock_timeout = '2s';

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

  -- Holding the job lock prevents cancellation racing a selection. A saved
  -- draft must never become a booking through a stale applicant screen/RPC.
  IF v_job.is_draft IS TRUE OR v_job.status IS NULL
     OR v_job.status NOT IN ('open', 'pending', 'awaiting_guard_selection', 'awaiting_payment') THEN
    RAISE EXCEPTION 'job_not_selectable';
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

    SELECT * INTO v_app FROM app.job_applications WHERE job_id = p_job_id AND guard_id = v_guard_id FOR UPDATE;
    IF v_app.id IS NULL THEN
      RAISE EXCEPTION 'not_an_applicant';
    END IF;

    -- Lock and recheck the current application, including retries. Withdrawn,
    -- rejected and completed applications cannot be revived by this endpoint.
    IF v_app.status IS NULL OR v_app.status NOT IN ('pending', 'shortlisted', 'selected', 'accepted') THEN
      RAISE EXCEPTION 'application_not_selectable';
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

REVOKE ALL ON FUNCTION app.select_job_guards(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.select_job_guards(uuid, jsonb) TO authenticated;
