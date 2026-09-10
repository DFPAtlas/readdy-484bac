-- ============================================================
-- Migration 035: Client Guard Selection — Atomic Provisional Selection
-- QuickGuard.uk
-- Business rule: CLIENT SELECTS FIRST → CLIENT PAYS SECOND → BOOKING CONFIRMS THIRD
--
-- A guard selected by the client is PROVISIONAL only until Stripe
-- confirms the individual job payment.
--
-- This function performs the whole selection write in ONE database
-- transaction (atomic). If any check or write fails, everything rolls back.
-- ============================================================

-- -----------------------------------------------------------------
-- RPC: app.select_job_guards(p_job_id uuid, p_selections jsonb)
--
-- p_selections shape (JSON array):
--   [
--     {
--       "guard_id": "...",
--       "agreed_hourly_rate": 15.00,
--       "agreed_hours": 16.0,
--       "gross_guard_amount": 240.00
--     },
--     ...
--   ]
--
-- Writes at selection time:
--   job_applications.status  = 'selected'
--   job_assignments.status   = 'awaiting_payment'
--   job_assignments.payment_status = 'pending'
--   jobs.status              = 'awaiting_payment'
--   jobs.payment_status      = 'pending'
--
-- Explicitly does NOT write:
--   assignment.status = 'confirmed'
--   job.status        = 'confirmed'
--   assignment.payment_status = 'funded'
--   any payout state
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.select_job_guards(
  p_job_id uuid,
  p_selections jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verify the caller is a client.
  SELECT c.id INTO v_client_id
  FROM app.clients c
  WHERE c.user_id = v_uid
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;

  -- Verify the client owns the job.
  SELECT * INTO v_job
  FROM app.jobs
  WHERE id = p_job_id
    AND client_id = v_client_id
    AND COALESCE(is_deleted, false) = false;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job_not_owned';
  END IF;

  -- Prevent selection after payment is already funded/paid.
  IF v_job.payment_status IN ('paid', 'funded', 'succeeded', 'complete', 'completed', 'held') THEN
    RAISE EXCEPTION 'job_already_paid';
  END IF;

  IF jsonb_typeof(p_selections) IS NULL OR jsonb_typeof(p_selections) <> 'array' THEN
    RAISE EXCEPTION 'invalid_selections';
  END IF;

  v_required_licence_types := COALESCE(v_job.required_licence_types, ARRAY[]::text[]);
  v_sia_required := COALESCE(v_job.sia_licence_required, false);

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_guard_id := (v_sel->>'guard_id')::uuid;
    IF v_guard_id IS NULL THEN
      RAISE EXCEPTION 'invalid_guard_id';
    END IF;

    -- Applicant must actually have applied to this job.
    SELECT * INTO v_app
    FROM app.job_applications
    WHERE job_id = p_job_id AND guard_id = v_guard_id;

    IF v_app.id IS NULL THEN
      RAISE EXCEPTION 'not_an_applicant';
    END IF;

    -- Hard eligibility checks.
    SELECT * INTO v_guard FROM app.guards WHERE id = v_guard_id;
    IF v_guard.id IS NULL THEN
      RAISE EXCEPTION 'guard_not_found';
    END IF;

    IF COALESCE(v_guard.is_active, false) = false THEN
      RAISE EXCEPTION 'guard_inactive';
    END IF;

    IF COALESCE(v_guard.profile_completed, false) = false THEN
      RAISE EXCEPTION 'guard_profile_incomplete';
    END IF;

    IF COALESCE(v_guard.verification_status, '') NOT IN ('approved', 'verified') THEN
      RAISE EXCEPTION 'guard_not_verified';
    END IF;

    IF v_sia_required THEN
      IF COALESCE(v_guard.sia_verified, false) = false THEN
        RAISE EXCEPTION 'guard_sia_not_verified';
      END IF;
      IF v_guard.sia_expiry_date IS NOT NULL AND v_guard.sia_expiry_date < now() THEN
        RAISE EXCEPTION 'guard_sia_expired';
      END IF;
    END IF;

    -- Licence type must match job requirement (when specified).
    IF array_length(v_required_licence_types, 1) > 0 THEN
      v_licence_match := false;
      IF v_guard.licence_types IS NOT NULL THEN
        FOREACH v_licence IN ARRAY v_guard.licence_types
        LOOP
          FOREACH v_req_licence IN ARRAY v_required_licence_types
          LOOP
            IF lower(v_licence) LIKE '%' || lower(v_req_licence) || '%'
               OR lower(v_req_licence) LIKE '%' || lower(v_licence) || '%' THEN
              v_licence_match := true;
              EXIT;
            END IF;
          END LOOP;
          IF v_licence_match THEN EXIT; END IF;
        END LOOP;
      END IF;

      IF NOT v_licence_match THEN
        RAISE EXCEPTION 'guard_licence_mismatch';
      END IF;
    END IF;

    -- Prevent duplicate assignment. Provisional (pre-payment) states are
    -- idempotent (the ON CONFLICT below refreshes them). Only a real booking
    -- (confirmed / assigned / active / in_progress / completed) blocks selection.
    SELECT count(*) INTO v_existing
    FROM app.job_assignments
    WHERE job_id = p_job_id
      AND guard_id = v_guard_id
      AND status IN ('confirmed', 'assigned', 'active', 'in_progress', 'completed');

    IF v_existing > 0 THEN
      RAISE EXCEPTION 'duplicate_assignment';
    END IF;

    -- Mark application as selected.
    UPDATE app.job_applications
    SET status = 'selected',
        reviewed_at = now(),
        updated_at = now()
    WHERE job_id = p_job_id AND guard_id = v_guard_id;

    -- Create / update provisional assignment (NOT confirmed, NOT funded).
    INSERT INTO app.job_assignments (
      job_id, guard_id, status, payment_status, assigned_at,
      agreed_hourly_rate, agreed_hours, gross_guard_amount, currency
    ) VALUES (
      p_job_id,
      v_guard_id,
      'awaiting_payment',
      'pending',
      now(),
      COALESCE((v_sel->>'agreed_hourly_rate')::numeric, v_job.hourly_rate),
      COALESCE((v_sel->>'agreed_hours')::numeric, 0),
      COALESCE((v_sel->>'gross_guard_amount')::numeric, 0),
      COALESCE(v_job.currency, 'GBP')
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

  IF v_selected_count = 0 THEN
    RAISE EXCEPTION 'no_selections';
  END IF;

  -- Move the job into awaiting_payment. Do NOT set confirmed/funded.
  UPDATE app.jobs
  SET status = 'awaiting_payment',
      payment_status = 'pending',
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'selected_count', v_selected_count,
    'job_status', 'awaiting_payment',
    'payment_status', 'pending'
  );
END;
$$;

-- Lock down execution to authenticated users only (client calls via supabase.rpc).
REVOKE ALL ON FUNCTION app.select_job_guards(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.select_job_guards(uuid, jsonb) TO authenticated;