begin;

-- The login endpoint rate-limits by both email and source IP. The existing
-- email index supports the first lookup; add the matching partial IP index.
create index if not exists idx_admin_login_attempts_ip_attempted_at
  on app.admin_login_attempts (ip_address, attempted_at desc)
  where ip_address is not null;

comment on table app.admin_login_attempts is
  'Server-written audit trail for successful and failed admin login attempts.';

-- No application path creates completion-task rows. Completion state is held
-- by job_completion_requests and the payout/audit tables instead.
drop view if exists public.job_completion_tasks;
drop table if exists app.job_completion_tasks;

commit;
