-- Batch 1: close session/log exposure and privileged view bypasses.
-- No business rows are modified or removed.
ALTER POLICY "Service role can manage sessions" ON app.admin_sessions TO service_role;
REVOKE ALL ON app.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON app.admin_sessions TO authenticated;
-- Existing own-session and active super-admin SELECT policies require aal2.

DROP POLICY IF EXISTS "Users can manage own cleanup logs" ON app.cleanup_log;
CREATE POLICY cleanup_log_admin_select ON app.cleanup_log
  FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));
CREATE POLICY cleanup_log_backend_all ON app.cleanup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON app.cleanup_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON app.cleanup_log TO authenticated;

ALTER POLICY "Service role only" ON public.cleanup_log TO service_role;
CREATE POLICY cleanup_log_admin_select ON public.cleanup_log
  FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));
REVOKE ALL ON public.cleanup_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cleanup_log TO authenticated;

ALTER VIEW app.user_entitlements SET (security_invoker = true);
REVOKE ALL ON app.user_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON app.user_entitlements TO authenticated;

REVOKE ALL ON app.n8n_open_jobs, app.n8n_active_verified_guards,
  app.n8n_job_assignments_open, app.n8n_job_completion_candidates,
  app.n8n_subscription_subjects FROM PUBLIC, anon, authenticated;
-- service_role already has backend access; retain its existing grants.
ALTER VIEW app.n8n_open_jobs SET (security_invoker = true);
ALTER VIEW app.n8n_active_verified_guards SET (security_invoker = true);
ALTER VIEW app.n8n_job_assignments_open SET (security_invoker = true);
ALTER VIEW app.n8n_job_completion_candidates SET (security_invoker = true);
ALTER VIEW app.n8n_subscription_subjects SET (security_invoker = true);
