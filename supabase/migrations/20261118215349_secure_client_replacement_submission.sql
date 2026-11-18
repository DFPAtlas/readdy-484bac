-- Service-only transaction. The Edge Function supplies the verified auth user.
-- Existing customer SELECT policies and historical rows remain unchanged.
CREATE OR REPLACE FUNCTION app.submit_client_replacement_request(
  p_user_id uuid, p_request_id uuid, p_client_id uuid, p_job_id uuid,
  p_assignment_id uuid, p_reason text, p_urgency text, p_arrival text,
  p_notes text, p_phone text, p_create_ticket boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, app
AS $$
DECLARE
  v_job app.jobs%ROWTYPE;
  v_assignment app.job_assignments%ROWTYPE;
  v_request app.replacement_requests%ROWTYPE;
  v_ticket uuid;
  v_arrival_local timestamp;
  v_arrival timestamptz;
  v_arrival_text text;
  v_notes text := nullif(btrim(p_notes), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_wants_ticket boolean := coalesce(p_create_ticket, false) AND p_urgency IN ('urgent', 'emergency');
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_client_id IS NULL OR p_job_id IS NULL OR p_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Invalid identifiers' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM app.account_closures WHERE user_id = p_user_id) OR
     NOT EXISTS (SELECT 1 FROM app.clients WHERE id = p_client_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Client account unavailable' USING ERRCODE = '42501';
  END IF;
  -- Lock the owned job before the idempotency lookup, serialising same-job submissions.
  SELECT * INTO v_job FROM app.jobs WHERE id = p_job_id AND client_id = p_client_id FOR UPDATE;
  IF NOT FOUND OR v_job.is_deleted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Job unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('no_show', 'late', 'cancelled', 'not_confirmed', 'other') OR
     p_urgency IS NULL OR p_urgency NOT IN ('normal', 'urgent', 'emergency') OR
     p_arrival IS NULL OR p_arrival !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' OR
     length(coalesce(p_notes, '')) > 2000 OR length(coalesce(p_phone, '')) > 60 OR
     (p_urgency = 'emergency' AND v_phone IS NULL) THEN
    RAISE EXCEPTION 'Invalid replacement details' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_arrival_local := p_arrival::timestamp;
    v_arrival := v_arrival_local AT TIME ZONE 'Europe/London';
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'Invalid arrival time' USING ERRCODE = '22023';
  END;
  IF to_char(v_arrival_local, 'YYYY-MM-DD"T"HH24:MI') <> p_arrival OR
     (v_arrival AT TIME ZONE 'Europe/London') <> v_arrival_local THEN
    RAISE EXCEPTION 'Invalid UK arrival time' USING ERRCODE = '22023';
  END IF;
  v_arrival_text := to_char(v_arrival AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  SELECT * INTO v_request FROM app.replacement_requests WHERE id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_request.client_id IS DISTINCT FROM p_client_id OR v_request.job_id IS DISTINCT FROM p_job_id OR
       v_request.assignment_id IS DISTINCT FROM p_assignment_id OR v_request.reason IS DISTINCT FROM p_reason OR
       v_request.urgency IS DISTINCT FROM p_urgency OR v_request.required_arrival_time IS DISTINCT FROM v_arrival_text OR
       v_request.notes IS DISTINCT FROM v_notes OR v_request.contact_phone IS DISTINCT FROM v_phone OR
       (v_request.support_ticket_id IS NOT NULL) IS DISTINCT FROM v_wants_ticket THEN
      RAISE EXCEPTION 'Request identifier already used for different details' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('requestId', v_request.id, 'clientId', v_request.client_id,
      'jobId', v_request.job_id, 'ticketId', v_request.support_ticket_id, 'status', v_request.status);
  END IF;
  IF v_arrival <= clock_timestamp() OR v_job.status IN ('completed', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'The job or arrival time is no longer eligible for replacement' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_assignment FROM app.job_assignments WHERE id = p_assignment_id AND job_id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_assignment.guard_id IS NULL OR v_assignment.status = 'completed' THEN
    RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO app.replacement_requests(id, client_id, job_id, assignment_id, guard_id, reason, urgency,
    required_arrival_time, notes, contact_phone, status)
  VALUES(p_request_id, p_client_id, p_job_id, p_assignment_id, v_assignment.guard_id, p_reason, p_urgency,
    v_arrival_text, v_notes, v_phone, 'requested');
  IF v_wants_ticket THEN
    INSERT INTO app.support_tickets(client_id, related_job_id, category, subject, description,
      priority, status, contact_preference, dfp_sync_status)
    VALUES(p_client_id, p_job_id, 'guard_no_show',
      'Replacement Request: ' || coalesce(v_job.job_title, 'Job') || ' - ' || p_urgency,
      'Replacement request ' || p_request_id || E'\nReason: ' || p_reason || E'\nUrgency: ' || p_urgency ||
      E'\nRequired by (UK time): ' || p_arrival || E'\nNotes: ' || coalesce(v_notes, 'None') ||
      E'\nContact: ' || coalesce(v_phone, 'Not provided'),
      CASE WHEN p_urgency = 'emergency' THEN 'urgent' ELSE 'high' END, 'open',
      CASE WHEN v_phone IS NULL THEN 'email' ELSE 'phone' END, 'pending') RETURNING id INTO v_ticket;
    UPDATE app.replacement_requests SET support_ticket_id = v_ticket WHERE id = p_request_id;
  END IF;
  UPDATE app.job_assignments SET replacement_requested = true, issue_reported = true,
    issue_type = 'replacement_needed', updated_at = clock_timestamp()
  WHERE id = p_assignment_id AND job_id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment update was not confirmed'; END IF;
  INSERT INTO app.notifications(user_id, user_type, type, title, message, link, is_read)
  VALUES(p_user_id, 'client', 'replacement_requested', 'Replacement Request Recorded',
    'Your replacement request for "' || coalesce(v_job.job_title, 'the job') || '" was recorded. Availability and booking require confirmation.',
    '/client/jobs/detail?id=' || p_job_id, false);
  RETURN jsonb_build_object('requestId', p_request_id, 'clientId', p_client_id,
    'jobId', p_job_id, 'ticketId', v_ticket, 'status', 'requested');
END;
$$;
REVOKE ALL ON FUNCTION app.submit_client_replacement_request(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.submit_client_replacement_request(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean) TO service_role;

-- Customers keep owner-scoped reads; all lifecycle writes go through verified server code.
ALTER TABLE app.replacement_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_insert_own_replacements ON app.replacement_requests;
DROP POLICY IF EXISTS client_update_own_replacements ON app.replacement_requests;
DROP POLICY IF EXISTS client_delete_own_replacements ON app.replacement_requests;
REVOKE INSERT, UPDATE, DELETE ON app.replacement_requests FROM PUBLIC, anon, authenticated;
-- Also remove any independent column-level write grants, without affecting reads.
DO $$ DECLARE columns text; BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO columns FROM pg_attribute
  WHERE attrelid = 'app.replacement_requests'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE 'REVOKE INSERT (' || columns || '), UPDATE (' || columns || ') ON app.replacement_requests FROM PUBLIC, anon, authenticated';
END $$;
NOTIFY pgrst, 'reload schema';
