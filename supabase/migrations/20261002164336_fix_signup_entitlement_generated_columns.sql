-- Keep signup provisioning compatible with generated entitlement flags.
CREATE OR REPLACE FUNCTION app.auto_create_entitlement_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO app.user_entitlements_data (
    user_id, plan_slug, plan_name, audience, features, monthly_price_pence,
    subscription_status, current_period_end, cancel_at_period_end, stripe_subscription_id
  )
  SELECT NEW.id, p.slug, p.name, p.audience, p.features, p.monthly_price_pence,
    'active', NULL, false, NULL
  FROM app.plans p
  WHERE p.slug = CASE NEW.user_type WHEN 'guard' THEN 'guard_starter' WHEN 'client' THEN 'client_free' END
    AND p.audience = NEW.user_type AND p.active = true AND p.monthly_price_pence = 0
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
