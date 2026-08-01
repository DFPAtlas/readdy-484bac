-- ============================================================
-- Migration 002: Row Level Security (RLS) Policies
-- QuickGuard.uk — Enable RLS and define access rules
-- ============================================================

-- NOTE: RLS is applied to the underlying `app` tables.
--       The public views have `security_invoker=true`, so
--       RLS policies on the app tables are enforced through
--       the views. public.plans and public.processed_events
--       are actual tables, so RLS goes directly on them.

-- -----------------------------------------------------------------
-- 1. ENABLE RLS ON ALL UNDERLYING TABLES
-- -----------------------------------------------------------------
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------
-- 2. APP.USERS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_users_select_own ON app.users
  FOR SELECT
  USING (id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_users_update_own ON app.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY IF NOT EXISTS app_users_admin_all ON app.users
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_users_service_update ON app.users
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- 3. APP.GUARDS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_guards_select_own ON app.guards
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_guards_update_own ON app.guards
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_guards_insert_own ON app.guards
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_guards_admin_all ON app.guards
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_guards_service_all ON app.guards
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 4. APP.CLIENTS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_clients_select_own ON app.clients
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_clients_update_own ON app.clients
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_clients_insert_own ON app.clients
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_clients_admin_all ON app.clients
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_clients_service_all ON app.clients
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 5. APP.SUBSCRIPTIONS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_subscriptions_select_own ON app.subscriptions
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_subscriptions_admin_all ON app.subscriptions
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_subscriptions_service_all ON app.subscriptions
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 6. PUBLIC.PLANS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS plans_select_public ON public.plans
  FOR SELECT
  USING (active = true);

CREATE POLICY IF NOT EXISTS plans_admin_all ON public.plans
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS plans_service_all ON public.plans
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 7. APP.USER_ENTITLEMENTS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_entitlements_select_own ON app.user_entitlements
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_entitlements_admin_all ON app.user_entitlements
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_entitlements_service_all ON app.user_entitlements
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 8. PUBLIC.PROCESSED_EVENTS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS processed_events_service_all ON public.processed_events
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS processed_events_admin_select ON public.processed_events
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- -----------------------------------------------------------------
-- 9. APP.TRANSACTIONS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_transactions_select_own ON app.transactions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR client_id = auth.uid()
    OR guard_id = auth.uid()
    OR is_admin(auth.uid())
  );

CREATE POLICY IF NOT EXISTS app_transactions_admin_all ON app.transactions
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_transactions_service_all ON app.transactions
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------
-- 10. APP.NOTIFICATIONS TABLE POLICIES
-- -----------------------------------------------------------------
CREATE POLICY IF NOT EXISTS app_notifications_select_own ON app.notifications
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_notifications_update_own ON app.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_notifications_delete_own ON app.notifications
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS app_notifications_admin_all ON app.notifications
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS app_notifications_service_all ON app.notifications
  FOR ALL
  TO service_role
  USING (true);