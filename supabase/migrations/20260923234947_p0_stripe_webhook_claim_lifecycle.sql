-- QuickGuard P0 Stripe webhook claim lifecycle.
-- Existing historical processed_events rows are treated as completed.

ALTER TABLE app.processed_events
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token text;

UPDATE app.processed_events
SET
  status = 'completed',
  claimed_at = COALESCE(claimed_at, processed_at, now()),
  completed_at = COALESCE(completed_at, processed_at, now()),
  claim_token = NULL
WHERE status IS NULL;

ALTER TABLE app.processed_events
  ALTER COLUMN status SET DEFAULT 'completed',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'app.processed_events'::regclass
      AND conname = 'processed_events_status_check'
  ) THEN
    ALTER TABLE app.processed_events
      ADD CONSTRAINT processed_events_status_check
      CHECK (status IN ('processing', 'completed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_processed_events_status_completed_at
  ON app.processed_events (status, completed_at);

CREATE OR REPLACE FUNCTION public.fn_cleanup_processed_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 90;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_log_id := extensions.gen_random_uuid();

  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'processed_events', v_retention, now());

  WITH deleted AS (
    DELETE FROM app.processed_events
    WHERE status = 'completed'
      AND COALESCE(completed_at, processed_at) < now() - (v_retention || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_processed_events failed: %', SQLERRM;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_cleanup_processed_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cleanup_processed_events() FROM anon;
REVOKE ALL ON FUNCTION public.fn_cleanup_processed_events() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_processed_events() TO service_role;
