-- 013: Guard Starter Plan & Feature Key Alignment
-- Stage 1: Foundation only. No application limit enforcement.

-- 1. Upsert guard_starter plan
INSERT INTO plans (slug, name, audience, monthly_price_pence, stripe_price_id, stripe_product_id, stripe_annual_price_id, active, job_limit_per_month, features)
VALUES ('guard_starter', 'Starter', 'guard', 0, NULL, NULL, NULL, true, 1, '["guard.apply_job","guard.view_jobs","guard.create_profile","guard.advanced_alerts"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  audience = EXCLUDED.audience,
  monthly_price_pence = EXCLUDED.monthly_price_pence,
  stripe_price_id = EXCLUDED.stripe_price_id,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_annual_price_id = EXCLUDED.stripe_annual_price_id,
  active = EXCLUDED.active,
  job_limit_per_month = EXCLUDED.job_limit_per_month,
  features = EXCLUDED.features;

-- 2. Set monthly application limits for paid guard plans
UPDATE plans SET job_limit_per_month = 10 WHERE slug = 'guard-basic';
UPDATE plans SET job_limit_per_month = 25 WHERE slug = 'guard-pro';
UPDATE plans SET job_limit_per_month = NULL WHERE slug = 'guard-elite';

-- 3. Clean user_entitlements.features for guard_starter users
UPDATE user_entitlements
SET features = '["guard.apply_job","guard.view_jobs","guard.create_profile","guard.advanced_alerts"]'::jsonb
WHERE plan_slug = 'guard_starter' AND audience = 'guard';

-- 4. Clean user_entitlements.features for guard-pro users
UPDATE user_entitlements
SET features = '["guard.apply_job","guard.view_jobs","guard.create_profile","guard.priority_profile","guard.profile_boost","guard.advanced_alerts","guard.performance_analytics","guard.priority_support","guard.direct_contact"]'::jsonb
WHERE plan_slug = 'guard-pro' AND audience = 'guard';