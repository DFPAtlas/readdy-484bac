-- Keep the existing external SIA worker and result handling; enforce a seven-day maximum recheck interval.
CREATE OR REPLACE FUNCTION app.cap_sia_recheck_interval()
RETURNS trigger LANGUAGE plpgsql SET search_path = app, pg_catalog AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.decision = 'approve' AND NEW.checked_at IS NOT NULL THEN
    NEW.next_recheck_at := LEAST(COALESCE(NEW.next_recheck_at, NEW.checked_at + interval '7 days'), NEW.checked_at + interval '7 days');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.cap_sia_recheck_interval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_cap_sia_recheck_interval
BEFORE INSERT OR UPDATE ON app.sia_checks
FOR EACH ROW EXECUTE FUNCTION app.cap_sia_recheck_interval();

UPDATE app.sia_checks SET next_recheck_at = LEAST(COALESCE(next_recheck_at, checked_at + interval '7 days'), checked_at + interval '7 days')
WHERE status = 'done' AND decision = 'approve' AND checked_at IS NOT NULL;

CREATE OR REPLACE FUNCTION app.enqueue_sia_rechecks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $$
DECLARE n integer; v_existing integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('app.enqueue_sia_rechecks'));
  INSERT INTO app.sia_checks
    (subject_type, subject_id, licence_number, expected_first_name, expected_surname, required_sectors, reason)
  SELECT 'guard', g.id, regexp_replace(g.sia_licence_number, '\s', '', 'g'),
    COALESCE(l.expected_first_name, NULLIF(regexp_replace(btrim(g.full_name), '\s+\S+$', ''), btrim(g.full_name))),
    COALESCE(l.expected_surname, substring(btrim(g.full_name) from '\S+$')),
    l.required_sectors, 'recheck'
  FROM app.guards g
  LEFT JOIN app.sia_latest l ON l.subject_type = 'guard' AND l.subject_id = g.id
    AND l.licence_number = regexp_replace(g.sia_licence_number, '\s', '', 'g')
  WHERE g.is_active AND g.sia_verified AND g.verification_status IN ('approved', 'verified')
    AND regexp_replace(g.sia_licence_number, '\s', '', 'g') ~ '^[0-9]{16}$'
    AND LEAST(COALESCE(l.next_recheck_at, 'infinity'::timestamptz),
      COALESCE(l.checked_at, g.sia_verified_at, g.created_at) + interval '7 days') <= now()
    AND NOT EXISTS (SELECT 1 FROM app.sia_checks p WHERE p.subject_type = 'guard'
      AND p.subject_id = g.id AND (p.status IN ('pending', 'processing') OR p.created_at > now() - interval '24 hours'));
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Retain existing non-guard queue subjects.
  INSERT INTO app.sia_checks
    (tenant_id, subject_type, subject_id, licence_number, expected_first_name, expected_surname, required_sectors, reason)
  SELECT l.tenant_id, l.subject_type, l.subject_id, l.licence_number,
    l.expected_first_name, l.expected_surname, l.required_sectors, 'recheck'
  FROM app.sia_latest l
  WHERE l.subject_type <> 'guard' AND l.next_recheck_at <= now()
    AND NOT EXISTS (SELECT 1 FROM app.sia_checks p WHERE p.subject_type = l.subject_type AND p.subject_id = l.subject_id
      AND (p.status IN ('pending', 'processing') OR p.created_at > now() - interval '24 hours'));
  GET DIAGNOSTICS v_existing = ROW_COUNT;

  -- Surface worker outages rather than treating a queued check as verification.
  INSERT INTO app.admin_alerts(alert_type, severity, user_id, title, message, metadata, status, created_at)
  SELECT 'sia_recheck_failed', 'warning', a.user_id, 'SIA check worker needs attention',
    'A queued SIA check has not completed within one hour. Check the verification worker before relying on this licence result.',
    jsonb_build_object('guard_id', p.subject_id, 'check_id', p.id, 'queue_status', p.status), 'unread', now()
  FROM app.sia_checks p CROSS JOIN app.admin_users a
  WHERE a.is_active AND p.subject_type = 'guard' AND p.status IN ('pending', 'processing')
    AND p.created_at < now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM app.admin_alerts x WHERE x.user_id = a.user_id
      AND x.metadata->>'check_id' = p.id::text AND x.created_at > now() - interval '24 hours');
  RETURN n + v_existing;
END;
$$;
REVOKE ALL ON FUNCTION app.enqueue_sia_rechecks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.enqueue_sia_rechecks() TO service_role;
-- Hourly due-date polling queues each licence when its seven-day interval expires.
SELECT cron.schedule('sia-rechecks', '0 * * * *', 'select app.enqueue_sia_rechecks()');
