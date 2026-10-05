-- Auto release was retired in favour of completion approval + create-guard-payout.
-- Its stale schedule fails on an empty JSON body and would otherwise call a 410.
-- Keep the job definition and run history for audit; do not revive automatic payouts.
DO $migration$
DECLARE
  retired_job record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;

  FOR retired_job IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'auto-release-guard-payments'
       OR command LIKE '%/functions/v1/auto-release-guard-payments%'
  LOOP
    PERFORM cron.alter_job(job_id := retired_job.jobid, active := false);
  END LOOP;
END
$migration$;
