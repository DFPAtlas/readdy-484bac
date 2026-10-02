-- Authoritative billing and SIA records are written by trusted backend workflows.
DROP POLICY IF EXISTS subscriptions_insert_own ON app.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_own ON app.subscriptions;
DROP POLICY IF EXISTS sia_insert_own ON app.sia_verifications;
DROP POLICY IF EXISTS sia_update_own ON app.sia_verifications;
DROP POLICY IF EXISTS sia_delete_own ON app.sia_verifications;
DROP POLICY IF EXISTS user_entitlements_data_insert_own ON app.user_entitlements_data;
DROP POLICY IF EXISTS user_entitlements_data_update_own ON app.user_entitlements_data;
DROP POLICY IF EXISTS app_entitlements_admin_all ON app.user_entitlements_data;
CREATE POLICY entitlements_admin_read ON app.user_entitlements_data
  FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));
ALTER POLICY "Service role full access" ON app.user_entitlements_data TO service_role;

-- Revoke write privileges on both canonical tables and compatibility views.
-- Explicit column grants must also be removed (table revokes do not remove them).
DO $$
DECLARE obj text; cols text;
BEGIN
  FOREACH obj IN ARRAY ARRAY[
    'app.subscriptions', 'app.sia_verifications', 'app.user_entitlements_data',
    'app.user_entitlements', 'public.subscriptions', 'public.sia_verifications',
    'public.user_entitlements'
  ] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM PUBLIC, anon, authenticated', obj);
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols
      FROM pg_attribute WHERE attrelid = obj::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s), SELECT (%s) ON TABLE %s FROM PUBLIC, anon, authenticated', cols, cols, cols, cols, obj);
    EXECUTE format('GRANT SELECT ON TABLE %s TO authenticated', obj);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO service_role', obj);
  END LOOP;
END $$;
ALTER VIEW public.subscriptions SET (security_invoker = true);
ALTER VIEW public.sia_verifications SET (security_invoker = true);
ALTER VIEW public.user_entitlements SET (security_invoker = true);

-- Repair only the caller's missing free entitlement. No user/plan/features arguments.
CREATE FUNCTION app.ensure_my_free_entitlement()
RETURNS SETOF app.user_entitlements_data
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  account_audience text;
  free_slug text;
BEGIN
  IF caller_id IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.user_entitlements_data WHERE user_id = caller_id) THEN
    SELECT user_type INTO account_audience FROM app.users WHERE id = caller_id;
    free_slug := CASE account_audience WHEN 'guard' THEN 'guard_starter' WHEN 'client' THEN 'client_free' END;
    INSERT INTO app.user_entitlements_data (
      user_id, plan_slug, plan_name, audience, features, monthly_price_pence,
      subscription_status, current_period_end, cancel_at_period_end,
      stripe_subscription_id, is_active, is_free_tier
    )
    SELECT caller_id, p.slug, p.name, p.audience, p.features, p.monthly_price_pence,
      'free', NULL, false, NULL, true, true
    FROM app.plans p
    WHERE p.slug = free_slug AND p.audience = account_audience
      AND p.active = true AND p.monthly_price_pence = 0
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN QUERY SELECT e.* FROM app.user_entitlements_data e WHERE e.user_id = caller_id;
END $$;
REVOKE ALL ON FUNCTION app.ensure_my_free_entitlement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.ensure_my_free_entitlement() TO authenticated;
