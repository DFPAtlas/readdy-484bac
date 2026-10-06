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

-- 6b. At most one queue row per idempotency key (e.g.
--     immediate-job:{jobId}:guard:{guardId}). The partial predicate means
--     legacy queue rows without a key are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_idempotency
  ON app.email_queue ((metadata->>'idempotency_key'))
  WHERE (metadata->>'idempotency_key') IS NOT NULL;

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
BEGIN
  SELECT id, status INTO v_id, v_status
  FROM app.email_queue
  WHERE metadata->>'idempotency_key' = p_idempotency_key
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_status = 'sent' THEN
      RETURN 'delivered';
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

  INSERT INTO app.email_queue
    (user_id, email_type, recipient_email, recipient_name, subject, body_html,
     status, priority, metadata, created_at, updated_at)
  VALUES
    (p_user_id, 'job_match', p_recipient_email, p_recipient_name, p_subject,
     '<p>You have a new QuickGuard job match. Open your dashboard to view and apply.</p>',
     'pending', coalesce(p_priority, 5), p_metadata, now(), now());

  RETURN 'queued';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'queued';
END;
$function$;

REVOKE ALL ON FUNCTION app.queue_job_match_notification(uuid, uuid, uuid, text, text, text, text, jsonb, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.queue_job_match_notification(uuid, uuid, uuid, text, text, text, text, jsonb, integer) TO service_role;

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
  v_inflight int;
  v_status text;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'sent'),
    count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status IN ('pending', 'processing', 'queued', 'sending'))
  INTO v_total, v_sent, v_failed, v_inflight
  FROM app.email_queue
  WHERE metadata->>'job_id' = p_job_id::text;

  IF coalesce(v_total, 0) = 0 THEN
    RETURN NULL;
  END IF;

  IF v_sent = v_total THEN
    v_status := 'delivered';
  ELSIF v_sent > 0 THEN
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