-- Route client writes through the cancellation function, which verifies booking ownership.
SET LOCAL lock_timeout = '500ms';

DROP POLICY client_own_cancellations_insert ON app.job_cancellations;
DROP POLICY client_own_cancellations_update ON app.job_cancellations;

ALTER POLICY "Service role full access on job_cancellations"
  ON app.job_cancellations TO service_role;

-- Keep the existing cancellation-record owner rule and the assigned-guard read path.
-- Match a booking's client profile to the authenticated user's ID.
ALTER POLICY "Users can view own job cancellations"
  ON app.job_cancellations TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app.jobs AS job
      WHERE job.id = job_cancellations.job_id
        AND (
          EXISTS (
            SELECT 1
            FROM app.clients AS client
            WHERE client.id = job.client_id
              AND client.user_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM app.job_assignments AS assignment
            JOIN app.guards AS guard ON guard.id = assignment.guard_id
            WHERE assignment.job_id = job.id
              AND guard.user_id = (SELECT auth.uid())
          )
        )
    )
  );
