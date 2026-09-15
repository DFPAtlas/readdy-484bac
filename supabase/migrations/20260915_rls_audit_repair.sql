-- ============================================================================
-- 20260915_rls_audit_repair.sql
-- QuickGuard — RLS access-control audit repair (Prompt 3 of 3)
--
-- Repairs over-broad RLS policies that exposed admin / private / automation
-- data to anonymous users or any authenticated (guard/client) user.
--
-- Each fix follows: DROP the unsafe policy first, then recreate a narrowly
-- scoped replacement (small explicit policies over broad `authenticated`).
-- No tables renamed. No columns dropped. No data changed. No marketplace
-- logic altered. Idempotent (DROP POLICY IF EXISTS + CREATE POLICY).
--
-- Convention: admin reads use is_active_admin() which already enforces the
-- AAL2 (strong-auth) gate. Service-role writes are explicitly TO service_role.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. admin_registration_audit — any authenticated user could read admin
--    registration PII (emails/IPs). Admin read already covered by
--    "admin_registration_audit_admin_select".
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read admin registration audit" ON app.admin_registration_audit;

-- ---------------------------------------------------------------------------
-- 2. app.cleanup_log — any authenticated user had full CRUD on automation logs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own cleanup logs" ON app.cleanup_log;
CREATE POLICY "cleanup_log_service_role_all" ON app.cleanup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "cleanup_log_admin_select" ON app.cleanup_log
  FOR SELECT TO authenticated USING (is_active_admin());

-- ---------------------------------------------------------------------------
-- 3. public.cleanup_log — "Service role only" was granted TO public (everyone).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role only" ON public.cleanup_log;
CREATE POLICY "cleanup_log_service_role_all" ON public.cleanup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. app.guardianhub_leads — any authenticated user could read lead PII.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read guardianhub leads" ON app.guardianhub_leads;
CREATE POLICY "guardianhub_leads_service_role_all" ON app.guardianhub_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "guardianhub_leads_admin_select" ON app.guardianhub_leads
  FOR SELECT TO authenticated USING (is_active_admin());

-- ---------------------------------------------------------------------------
-- 5. app.finance_snapshots — any authenticated user could read financial data.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own finance snapshots" ON app.finance_snapshots;
CREATE POLICY "finance_snapshots_service_role_all" ON app.finance_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "finance_snapshots_admin_select" ON app.finance_snapshots
  FOR SELECT TO authenticated USING (is_active_admin());

-- ---------------------------------------------------------------------------
-- 6. app.email_provider_daily_usage — any authenticated user could read email
--    sending statistics.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read email provider usage" ON app.email_provider_daily_usage;
CREATE POLICY "email_provider_daily_usage_service_role_all" ON app.email_provider_daily_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "email_provider_daily_usage_admin_select" ON app.email_provider_daily_usage
  FOR SELECT TO authenticated USING (is_active_admin());

-- ---------------------------------------------------------------------------
-- 7. app.admin_sessions — "Service role can manage sessions" was granted TO
--    public (anyone could read/write admin sessions).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage sessions" ON app.admin_sessions;
CREATE POLICY "admin_sessions_service_role_all" ON app.admin_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. public.consent_records — "Service role can manage all consent" was
--    granted TO public (anyone could read/write all consent records).
--    Owner insert/view policies remain, so users keep their own consent.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage all consent" ON public.consent_records;
CREATE POLICY "consent_records_service_role_all" ON public.consent_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 9. app.payment_events — "Service role manages payment events" INSERT was
--    granted TO public (anyone could forge payment events). Owner insert and
--    admin/own select policies remain.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role manages payment events" ON app.payment_events;
CREATE POLICY "payment_events_service_role_insert" ON app.payment_events
  FOR INSERT TO service_role WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10. public.push_subscriptions — "Service role can read all push
--     subscriptions" was granted TO public (anyone could read device tokens).
--     Owner-management and service-insert policies remain.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can read all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_service_role_select" ON public.push_subscriptions
  FOR SELECT TO service_role USING (true);

-- ---------------------------------------------------------------------------
-- 11. app.guard_verification_audit — "System can insert audit" INSERT was
--     granted TO public (anyone could forge verification-audit rows). Admin
--     read policy remains.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert audit" ON app.guard_verification_audit;
CREATE POLICY "guard_verification_audit_service_role_insert" ON app.guard_verification_audit
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- Verification (run after migration)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, roles::text, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname IN ('app','public')
--   AND ((qual = 'true' AND NOT roles <@ ARRAY['service_role']::name[])
--     OR (with_check = 'true' AND NOT roles <@ ARRAY['service_role']::name[]))
-- ORDER BY tablename, policyname;

COMMIT;