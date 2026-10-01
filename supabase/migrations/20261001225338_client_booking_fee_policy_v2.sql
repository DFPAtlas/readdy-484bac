-- Client subscriptions buy access and lower booking fees. Processing is included.
-- Existing checkout snapshots, assignments and transactions are not modified.
DO $policy$
DECLARE schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['app', 'public'] LOOP
    EXECUTE format('INSERT INTO %I.plan_fee_rules (plan_slug, platform_fee_percent, platform_fee_fixed_pence, stripe_fee_payer) VALUES (''client_free'',15,0,''quickguard'') ON CONFLICT (plan_slug) DO NOTHING', schema_name);
    EXECUTE format('UPDATE %I.plan_fee_rules SET platform_fee_percent = CASE WHEN plan_slug IN (''client_free'',''client-free'',''payg'') THEN 15 WHEN plan_slug = ''client-starter'' THEN 10 WHEN plan_slug = ''client-pro'' THEN 7.5 WHEN plan_slug = ''client-enterprise'' THEN 5 ELSE 0 END, platform_fee_fixed_pence = 0, stripe_fee_payer = ''quickguard'', show_vat_estimate = false, updated_at = now() WHERE plan_slug IN (''client_free'',''client-free'',''payg'',''client-starter'',''client-pro'',''client-enterprise'',''guard_starter'',''guard-starter'',''guard-basic'',''guard-pro'',''guard-elite'')', schema_name);
  END LOOP;
END $policy$;
