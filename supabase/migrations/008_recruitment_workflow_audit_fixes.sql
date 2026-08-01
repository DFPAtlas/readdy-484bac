-- ============================================================
-- Migration 008: Full Recruitment Workflow Audit Fixes
-- Date: 2026-06-02
-- ============================================================

-- FIX 1: Add missing shortlisted column to job_applications
-- Referenced in SelectGuardsClient.tsx toggleShortlist() but
-- column did not exist, causing PGRST204 silent errors
ALTER TABLE app.job_applications ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT FALSE;

-- FIX 2: Recreate public view to expose shortlisted
CREATE OR REPLACE VIEW public.job_applications WITH (security_invoker=true) AS
SELECT
  id, job_id, guard_id, status, cover_message, applied_at, reviewed_at,
  cover_letter, updated_at, created_at, shortlisted
FROM app.job_applications;

-- FIX 3: Guard update policy was missing — guards couldn't update their
-- own application status (accept/decline offers from dashboard)
-- Only create if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'app'
      AND tablename = 'job_applications'
      AND policyname = 'job_apps_guard_update'
  ) THEN
    EXECUTE $p$
      CREATE POLICY job_apps_guard_update ON app.job_applications
        FOR UPDATE TO public
        USING (guard_id IN (SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()))
        WITH CHECK (guard_id IN (SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()))
    $p$;
  END IF;
END $$;

-- FIX 4: Remove duplicate trigger that caused applications_count
-- to be double-incremented on INSERT/DELETE
-- trigger_update_applications_count (simple +/-1)  +
-- job_applications_update_counts (calls recompute) = double count
DROP TRIGGER IF EXISTS trigger_update_applications_count ON app.job_applications;

-- FIX 5: Remove duplicate updated_at triggers on jobs table
-- (set_updated_at, set_updated_at_jobs, trg_app_jobs_updated_at all do the same thing)
DROP TRIGGER IF EXISTS set_updated_at ON app.jobs;
DROP TRIGGER IF EXISTS set_updated_at_jobs ON app.jobs;

-- FIX 6: Remove duplicate guard job stats trigger on job_assignments
-- (trg_guard_job_stats and trigger_update_guard_job_stats both fire on UPDATE)
DROP TRIGGER IF EXISTS trigger_update_guard_job_stats ON app.job_assignments;

-- FIX 7: Recompute applications_count on jobs to fix any double-counted values
UPDATE app.jobs j
SET applications_count = (
  SELECT COUNT(*)
  FROM app.job_applications a
  WHERE a.job_id = j.id
)
WHERE j.is_deleted = false OR j.is_deleted IS NULL;

-- FIX 8: Recompute assigned_count on jobs to fix any stale values
UPDATE app.jobs j
SET assigned_count = (
  SELECT COUNT(*)
  FROM app.job_assignments a
  WHERE a.job_id = j.id
  AND a.status NOT IN ('cancelled', 'withdrawn')
)
WHERE j.is_deleted = false OR j.is_deleted IS NULL;

SELECT 'migration_008_complete' AS status;