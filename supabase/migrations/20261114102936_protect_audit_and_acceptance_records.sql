-- Keep interactive access to history read-only and retain backend writers.
SET LOCAL lock_timeout = '500ms';

DROP POLICY audit_log_admin_access ON app.audit_log;
DROP POLICY audit_log_admin_access_v2 ON app.audit_log;
CREATE POLICY audit_log_admin_select ON app.audit_log
  FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "Service role manages payment audit logs" ON app.payment_audit_logs
  TO service_role;

DROP POLICY "Users can manage own tax disclaimers" ON app.tax_disclaimers_accepted;
CREATE POLICY "Users can read own tax disclaimers" ON app.tax_disclaimers_accepted
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can append own tax disclaimers" ON app.tax_disclaimers_accepted
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON app.audit_log, app.payment_audit_logs FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON app.tax_disclaimers_accepted FROM anon, authenticated;
