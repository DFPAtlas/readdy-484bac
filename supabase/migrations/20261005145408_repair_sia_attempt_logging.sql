-- Queue attempts share the audit table with completed verification results.
-- Pending/manual-review attempts have no licence result yet; do not invent one.
-- Preserve all existing results, foreign keys, licence status checks and access policies.
ALTER TABLE app.sia_verifications
  ALTER COLUMN verified DROP NOT NULL,
  ALTER COLUMN license_status DROP NOT NULL,
  ALTER COLUMN verified_at DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
-- Completed results still require all three result fields together.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app.sia_verifications'::regclass
      AND conname = 'sia_verifications_complete_result_check'
  ) THEN
    ALTER TABLE app.sia_verifications ADD CONSTRAINT sia_verifications_complete_result_check
    CHECK (
      (verified IS NULL AND license_status IS NULL AND verified_at IS NULL)
      OR (verified IS NOT NULL AND license_status IS NOT NULL AND verified_at IS NOT NULL)
    );
  END IF;
END
$migration$;
