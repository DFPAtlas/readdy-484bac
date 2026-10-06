-- ============================================================
-- Phase 2: Immediate ("Book a Guard Now") booking integration
-- ------------------------------------------------------------
-- An immediate booking is a normal app.jobs row with urgent
-- classification. This migration adds ONLY what the acceptance
-- criteria require and what is not already present:
--   1. booking_source  -> records the trusted creation origin
--   2. submission_id   -> stable, per-client idempotency key
--   3. notification_*  -> durable, retryable delivery visibility
-- The job lifecycle, pricing, payment and payout tables are
-- deliberately untouched.
-- ============================================================

-- 1. New columns on app.jobs (no rename, no duplicate of existing fields)
ALTER TABLE app.jobs
  ADD COLUMN IF NOT EXISTS booking_source TEXT,
  ADD COLUMN IF NOT EXISTS submission_id TEXT,
  ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS notification_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_error TEXT,
  ADD COLUMN IF NOT EXISTS notification_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_guard_count INTEGER DEFAULT 0;

-- 2. Backfill existing rows so nothing is left null
UPDATE app.jobs SET notification_status = 'none' WHERE notification_status IS NULL;
UPDATE app.jobs SET notification_attempts = 0 WHERE notification_attempts IS NULL;
UPDATE app.jobs SET notified_guard_count = 0 WHERE notified_guard_count IS NULL;

-- 3. Idempotency: at most one job per (client, submission).
--    A NULL submission_id (standard posting) is always allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_client_submission
  ON app.jobs (client_id, submission_id)
  WHERE submission_id IS NOT NULL;

-- 4. Fast lookups for the immediate-jobs filter and delivery retry queue
CREATE INDEX IF NOT EXISTS idx_jobs_booking_source
  ON app.jobs (booking_source) WHERE booking_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_immediate_created
  ON app.jobs (created_at) WHERE urgency = 'immediate' AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_jobs_notification_status
  ON app.jobs (notification_status) WHERE notification_status IN ('failed', 'partial');

-- 5. Let PostgREST pick up the new columns
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 6. Durable guard-notification delivery (Phase 2 correction)
-- ------------------------------------------------------------
-- Immediate and standard guard emails are placed in the EXISTING
-- app.email_queue table and delivered by the EXISTING process-email-queue
-- worker. No second email system is introduced. These additions only make
-- that queue idempotent per job+guard and able to report honest delivery
-- states back onto the job.
-- ============================================================

-- 6a. Delivery timestamp used by the recompute function below.
ALTER TABLE app.jobs
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- 6b. The existing app.email_queue.dedupe_key column is the authoritative
--     idempotency field. A previous revision of this migration used a ROW
--     metadata expression index instead; drop it if the live database already
--     created it so there is a single dedupe mechanism. This is a no-op on
--     fresh databases.
DROP INDEX IF EXISTS app.uq_email_queue_idempotency;

-- 6b-1. Ensure the existing dedupe_key column is present (no duplicate
--       idempotency column is introduced; this is the canonical field).
ALTER TABLE app.email_queue
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- 6b-2. Fail clearly if duplicate non-null job-match dedupe keys already
--       exist. Building the unique index below on dirty data would fail
--       opaquely, so abort with an actionable message instead.
DO $$
DECLARE
  v_dupes int;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT dedupe_key
    FROM app.email_queue
    WHERE email_type = 'job_match' AND dedupe_key IS NOT NULL
    GROUP BY dedupe_key
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Phase 2 migration aborted: % duplicate non-null job_match dedupe_key value(s) already exist in app.email_queue. Resolve the duplicates before applying this migration.', v_dupes;
  END IF;
END $$;

-- 6b-3. Race-safe unique index scoped to job-match emails only. The general
--       queue indexes are left exactly as they are.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_job_match_dedupe
  ON app.email_queue (dedupe_key)
  WHERE email_type = 'job_match'
    AND dedupe_key IS NOT NULL;

-- 6c. Replace the delivery-status index so it covers the honest states.
DROP INDEX IF EXISTS app.idx_jobs_notification_status;
CREATE INDEX IF NOT EXISTS idx_jobs_notification_status
  ON app.jobs (notification_status)
  WHERE notification_status IN ('queued', 'partially_delivered', 'partial', 'failed');

-- 6d. Idempotent, atomic queueing of one guard notification.
--     - 'delivered' -> an identical notification was already sent; do nothing.
--     - 'queued'    -> a pending/in-flight row already exists; do nothing.
--     - 'retried'   -> a previously failed row is reset so the worker retries it.
--     - 'queued'    -> a brand new row was inserted.
CREATE OR REPLACE FUNCTION app.queue_job_match_notification(
  p_job_id uuid,
  p_guard_id uuid,
  p_user_id uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_subject text,
  p_idempotency_key text,
  p_metadata jsonb,
  p_priority integer default 5
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'app', 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_metadata jsonb;
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

  INSERT INTO app.email_queue
    (user_id, email_type, recipient_email, recipient_name, subject, body_html,
     status, priority, metadata, dedupe_key, created_at, updated_at)
  VALUES
    (p_user_id, 'job_match', p_recipient_email, p_recipient_name, p_subject,
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

REVOKE ALL ON FUNCTION app.queue_job_match_notification(uuid, uuid, uuid, text, text, text, text, jsonb, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.queue_job_match_notification(uuid, uuid, uuid, text, text, text, text, jsonb, integer) TO service_role;

-- 6d-1. Mark a queued job-match email as a terminal suppression (e.g. the
--       guard disabled job-match emails). Service-role only, and never resets
--       an already-sent row.
CREATE OR REPLACE FUNCTION app.suppress_email_queue(
  p_queue_id uuid,
  p_reason text default 'preference_disabled'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'app', 'public'
AS $function$
BEGIN
  UPDATE app.email_queue
    SET status = 'suppressed',
        error_message = left(coalesce(p_reason, 'preference_disabled'), 500),
        updated_at = now()
  WHERE id = p_queue_id
    AND status <> 'sent';
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION app.suppress_email_queue(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.suppress_email_queue(uuid, text) TO service_role;

-- 6e. Recompute the honest delivery state of a job from its queue rows.
--     'delivered' only when every queued email was accepted by the provider.
CREATE OR REPLACE FUNCTION app.recompute_job_notification_status(p_job_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'app', 'public'
AS $function$
DECLARE
  v_total int;
  v_sent int;
  v_failed int;
  v_suppressed int;
  v_inflight int;
  v_status text;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'sent'),
    count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status = 'suppressed'),
    count(*) FILTER (WHERE status IN ('pending', 'processing', 'queued', 'sending'))
  INTO v_total, v_sent, v_failed, v_suppressed, v_inflight
  FROM app.email_queue
  WHERE email_type = 'job_match'
    AND metadata->>'job_id' = p_job_id::text;

  IF coalesce(v_total, 0) = 0 THEN
    RETURN NULL;
  END IF;

  IF v_suppressed = v_total THEN
    -- Everyone who matched has opted out: nothing was actually delivered.
    v_status := 'none';
  ELSIF v_sent = v_total THEN
    v_status := 'delivered';
  ELSIF v_sent > 0 THEN
    -- Some sent, some suppressed or failed: honestly partial.
    v_status := 'partially_delivered';
  ELSIF v_failed > 0 AND v_inflight = 0 THEN
    v_status := 'failed';
  ELSE
    v_status := 'queued';
  END IF;

  UPDATE app.jobs
    SET notification_status = v_status,
        notified_guard_count = v_sent,
        notification_last_attempt_at = now(),
        notified_at = CASE WHEN v_status = 'delivered' THEN now() ELSE notified_at END
  WHERE id = p_job_id;

  RETURN v_status;
END;
$function$;

REVOKE ALL ON FUNCTION app.recompute_job_notification_status(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.recompute_job_notification_status(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';