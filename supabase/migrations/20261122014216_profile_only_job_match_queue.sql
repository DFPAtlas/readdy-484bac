-- Support job-match delivery for valid profile-only guard accounts.
-- Preserve the legacy queue FK, RLS, server-owned metadata and idempotency.
CREATE OR REPLACE FUNCTION app.queue_job_match_notification(p_job_id uuid, p_guard_id uuid, p_user_id uuid, p_recipient_email text, p_recipient_name text, p_subject text, p_idempotency_key text, p_metadata jsonb, p_priority integer DEFAULT 5)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'app', 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_metadata jsonb;
  v_legacy_user_id uuid;
BEGIN
  -- The authoritative dedupe key is the function argument; the caller's
  -- metadata payload never supplies it.
  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  SELECT id, status INTO v_id, v_status
  FROM app.email_queue
  WHERE email_type = 'job_match'
    AND dedupe_key = p_idempotency_key
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_status = 'sent' THEN
      RETURN 'delivered';
    ELSIF v_status = 'suppressed' THEN
      -- A guard who opted out is terminal. It is never reset for a retry, so
      -- an admin retry can never requeue a suppressed notification.
      RETURN 'suppressed';
    ELSIF v_status IN ('pending', 'processing', 'queued', 'sending') THEN
      RETURN 'queued';
    ELSE
      UPDATE app.email_queue
        SET status = 'pending',
            error_message = NULL,
            retry_count = 0,
            updated_at = now()
      WHERE id = v_id;
      RETURN 'retried';
    END IF;
  END IF;

  -- Server-merged metadata: the authoritative identifiers cannot be spoofed
  -- through p_metadata.
  v_metadata := v_metadata
    || jsonb_build_object(
         'job_id', p_job_id::text,
         'guard_record_id', p_guard_id::text,
         'guard_id', p_user_id::text,
         'notification_type', 'job_match',
         'idempotency_key', p_idempotency_key
       );

  -- Queue ownership is optional: valid Auth/profile accounts may have no
  -- legacy app.users mirror. Keep the trusted Auth identity in metadata.
  -- Hold any existing mirror against deletion until the FK insert completes.
  SELECT u.id INTO v_legacy_user_id
  FROM app.users u
  WHERE u.id = p_user_id
  FOR KEY SHARE;

  INSERT INTO app.email_queue
    (user_id, email_type, recipient_email, recipient_name, subject, body_html,
     status, priority, metadata, dedupe_key, created_at, updated_at)
  VALUES
    (v_legacy_user_id, 'job_match', p_recipient_email, p_recipient_name, p_subject,
     '<p>You have a new QuickGuard job match. Open your dashboard to view and apply.</p>',
     'pending', coalesce(p_priority, 5), v_metadata, p_idempotency_key, now(), now());

  RETURN 'queued';
EXCEPTION
  WHEN unique_violation THEN
    -- A concurrent insert won the race on uq_email_queue_job_match_dedupe.
    -- Re-read and report the existing row's state honestly instead of failing.
    SELECT status INTO v_status
    FROM app.email_queue
    WHERE email_type = 'job_match' AND dedupe_key = p_idempotency_key
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_status = 'sent' THEN
      RETURN 'delivered';
    ELSIF v_status = 'suppressed' THEN
      RETURN 'suppressed';
    END IF;
    RETURN 'queued';
END;
$function$;


REVOKE ALL ON FUNCTION app.queue_job_match_notification(uuid,uuid,uuid,text,text,text,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.queue_job_match_notification(uuid,uuid,uuid,text,text,text,text,jsonb,integer) TO service_role;

