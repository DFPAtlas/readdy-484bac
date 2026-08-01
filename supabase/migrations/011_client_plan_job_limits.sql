-- 011_client_plan_job_limits.sql
-- Stage 1: Add job_limit_per_month column, upsert client_free, update existing client plan limits.
-- No enforcement yet — storage only.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS job_limit_per_month INTEGER;

-- Upsert client_free plan (Free Starter)
INSERT INTO plans (slug, name, description, audience, monthly_price_pence, stripe_price_id, stripe_product_id, stripe_annual_price_id, active, job_limit_per_month, features, limitations)
VALUES (
  'client_free',
  'Free Starter',
  'Start posting jobs and viewing guard profiles with limited free access.',
  'client',
  0,
  NULL,
  NULL,
  NULL,
  true,
  1,
  ARRAY['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments'],
  ARRAY[
    'Limited to 1 job per month',
    'Upgrade required for advanced matching',
    'Upgrade required for job templates',
    'Upgrade required for analytics dashboard',
    'Upgrade required for direct contact',
    'Upgrade required for multi-site features'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  audience = EXCLUDED.audience,
  monthly_price_pence = EXCLUDED.monthly_price_pence,
  stripe_price_id = EXCLUDED.stripe_price_id,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_annual_price_id = EXCLUDED.stripe_annual_price_id,
  active = EXCLUDED.active,
  job_limit_per_month = EXCLUDED.job_limit_per_month,
  features = EXCLUDED.features,
  limitations = EXCLUDED.limitations,
  updated_at = now();

-- Update client-starter
UPDATE plans
SET
  job_limit_per_month = 10,
  limitations = ARRAY['Limited to 10 jobs per month', 'No priority matching', 'No dedicated support'],
  updated_at = now()
WHERE slug = 'client-starter';

-- Update client-pro
UPDATE plans
SET
  job_limit_per_month = 30,
  limitations = ARRAY['Limited to 30 jobs per month', 'No dedicated account manager', 'No bulk posting'],
  updated_at = now()
WHERE slug = 'client-pro';

-- Update client-enterprise
UPDATE plans
SET
  job_limit_per_month = NULL,
  limitations = ARRAY[]::text[],
  updated_at = now()
WHERE slug = 'client-enterprise';