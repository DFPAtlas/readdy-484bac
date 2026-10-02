-- Use the existing primary key to deduplicate worker alerts once per UTC day without scanning alert history.
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
  INSERT INTO app.admin_alerts(id, alert_type, severity, user_id, title, message, metadata, status, created_at)
  SELECT md5('sia-worker-delay:' || p.id::text || ':' || a.user_id::text || ':' || (now() AT TIME ZONE 'UTC')::date::text)::uuid, 'sia_recheck_failed', 'warning', a.user_id, 'SIA check worker needs attention',
    'A queued SIA check has not completed within one hour. Check the verification worker before relying on this licence result.',
    jsonb_build_object('guard_id', p.subject_id, 'check_id', p.id, 'queue_status', p.status), 'unread', now()
  FROM app.sia_checks p CROSS JOIN app.admin_users a
  WHERE a.is_active AND p.subject_type = 'guard' AND p.status IN ('pending', 'processing')
    AND p.created_at < now() - interval '1 hour'
  ON CONFLICT (id) DO NOTHING;
  RETURN n + v_existing;
END;
$$;
