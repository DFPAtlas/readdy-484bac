-- Preserve the existing URL, authentication, schedule and enabled state.
-- Do not execute the task or backfill any finance snapshot.
DO $migration$
DECLARE
  task record;
BEGIN
  FOR task IN SELECT jobid, command FROM cron.job
    WHERE jobname = 'monthly-finance-snapshot'
      AND strpos(command, $bad$body:=''::jsonb$bad$) > 0
  LOOP
    PERFORM cron.alter_job(task.jobid, command := replace(task.command,
      $bad$body:=''::jsonb$bad$, $good$body:='{}'::jsonb$good$));
  END LOOP;
END
$migration$;
