CREATE OR REPLACE FUNCTION app.ensure_my_free_entitlement()
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
      stripe_subscription_id
    )
    SELECT caller_id, p.slug, p.name, p.audience, p.features, p.monthly_price_pence,
      'active', NULL, false, NULL
    FROM app.plans p
    WHERE p.slug = free_slug AND p.audience = account_audience
      AND p.active = true AND p.monthly_price_pence = 0
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN QUERY SELECT e.* FROM app.user_entitlements_data e WHERE e.user_id = caller_id;
END $$;
REVOKE ALL ON FUNCTION app.ensure_my_free_entitlement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.ensure_my_free_entitlement() TO authenticated;
