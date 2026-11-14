-- Use the existing active-admin and MFA check for operational admin access.
SET LOCAL lock_timeout = '500ms';
SET LOCAL statement_timeout = '5s';

ALTER POLICY "client_activity_log_admin_all" ON app.client_activity_log
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all companies" ON app.companies
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all sites" ON app.company_sites
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all staff" ON app.company_staff
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all compliance" ON app.compliance_records
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all incidents" ON app.incidents
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "privacy_requests_admin_all" ON app.privacy_requests
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all rotas" ON app.rotas
  TO authenticated USING ((SELECT app.is_active_admin()));

ALTER POLICY "admin_tickets_all" ON app.support_tickets
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "support_tickets_admin_all" ON app.support_tickets
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "admin_messages_all" ON app.ticket_messages
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "Admin can read all training" ON app.training_records
  TO authenticated USING ((SELECT app.is_active_admin()));
