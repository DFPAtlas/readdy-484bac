-- Finding 1: multi-day pricing.
-- Guard selection previously sent agreed_hours = (final finish - first start) x days,
-- so two 8-hour shifts became 64 payable hours. select_job_guards stored those
-- browser-supplied hours and gross amounts verbatim and checkout charged them.
--
-- Authoritative rule (mirrors supabase/functions/_shared/shift-hours.ts and
-- lib/shift-hours.ts): payable hours per guard = daily shift hours x number_of_days,
-- where a finish at or before the start is an overnight shift.
-- select_job_guards now ignores browser-supplied hours/amounts and computes them.
-- Historical assignments, transactions and payouts are NOT modified here; see
-- app.booking_hours_reconciliation for the read-only review list.

create or replace function app.shift_hours(p_start time, p_end time)
returns numeric language sql immutable set search_path = pg_catalog as $$
  select case when p_start is null or p_end is null then null
    else (case when p_end <= p_start then extract(epoch from (p_end - p_start)) + 86400
               else extract(epoch from (p_end - p_start)) end) / 3600.0 end
$$;

create or replace function app.scheduled_days(p_number_of_days integer, p_start date, p_end date)
returns integer language sql immutable set search_path = pg_catalog as $$
  select case when p_number_of_days is not null and p_number_of_days >= 1 then p_number_of_days
              when p_start is not null and coalesce(p_end, p_start) >= p_start then (coalesce(p_end, p_start) - p_start) + 1
              else 1 end
$$;

create or replace function app.job_scheduled_hours(p_start_time time, p_end_time time, p_number_of_days integer, p_start_date date, p_end_date date)
returns numeric language sql immutable set search_path = app, pg_catalog as $$
  select round(app.shift_hours(p_start_time, p_end_time) * app.scheduled_days(p_number_of_days, p_start_date, p_end_date), 2)
$$;

revoke all on function app.shift_hours(time, time) from public;
revoke all on function app.scheduled_days(integer, date, date) from public;
revoke all on function app.job_scheduled_hours(time, time, integer, date, date) from public;
grant execute on function app.shift_hours(time, time) to authenticated, service_role;
grant execute on function app.scheduled_days(integer, date, date) to authenticated, service_role;
grant execute on function app.job_scheduled_hours(time, time, integer, date, date) to authenticated, service_role;

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
    IF COALESCE(v_guard.verification_status, '') NOT IN ('approved', 'verified') THEN RAISE EXCEPTION 'guard_not_verified'; END IF;

    IF v_sia_required THEN
      IF COALESCE(v_guard.sia_verified, false) = false THEN RAISE EXCEPTION 'guard_sia_not_verified'; END IF;
      IF v_guard.sia_expiry_date IS NOT NULL AND v_guard.sia_expiry_date < now() THEN RAISE EXCEPTION 'guard_sia_expired'; END IF;
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

-- Read-only reconciliation list: assignments whose stored hours or gross pay
-- disagree with the authoritative schedule. Finance reviews these; nothing is
-- rewritten automatically. Service role / SQL editor only.
create or replace view app.booking_hours_reconciliation with (security_invoker = true) as
select a.id as assignment_id, a.job_id, a.guard_id, a.status as assignment_status, a.payment_status,
       j.job_title, j.start_date, j.end_date, j.start_time, j.end_time, j.number_of_days,
       a.agreed_hourly_rate, a.agreed_hours as stored_hours,
       app.job_scheduled_hours(j.start_time, j.end_time, j.number_of_days, j.start_date, j.end_date) as scheduled_hours,
       a.gross_guard_amount as stored_gross,
       round(a.agreed_hourly_rate * app.job_scheduled_hours(j.start_time, j.end_time, j.number_of_days, j.start_date, j.end_date), 2) as scheduled_gross,
       a.client_total_amount, a.guard_net_payout
from app.job_assignments a join app.jobs j on j.id = a.job_id
where abs(coalesce(a.agreed_hours, 0) - coalesce(app.job_scheduled_hours(j.start_time, j.end_time, j.number_of_days, j.start_date, j.end_date), 0)) > 0.01
   or abs(coalesce(a.gross_guard_amount, 0) - round(coalesce(a.agreed_hourly_rate, 0) * coalesce(app.job_scheduled_hours(j.start_time, j.end_time, j.number_of_days, j.start_date, j.end_date), 0), 2)) > 0.01;

revoke all on app.booking_hours_reconciliation from public, anon, authenticated;
grant select on app.booking_hours_reconciliation to service_role;
