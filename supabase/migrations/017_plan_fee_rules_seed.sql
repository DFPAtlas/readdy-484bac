-- Migration 017: Plan Fee Rules seed data
-- Ensures plan_fee_rules table exists and contains correct subscription-aware fee rules

CREATE TABLE IF NOT EXISTS app.plan_fee_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_slug TEXT NOT NULL,
  platform_fee_percent NUMERIC DEFAULT 0,
  platform_fee_fixed_pence INTEGER DEFAULT 0,
  stripe_fee_payer TEXT DEFAULT 'quickguard',
  payout_delay_days INTEGER DEFAULT 3,
  dispute_window_hours INTEGER DEFAULT 48,
  auto_release_hours INTEGER DEFAULT 72,
  max_active_jobs INTEGER DEFAULT 20,
  invoice_access BOOLEAN DEFAULT true,
  finance_export_access BOOLEAN DEFAULT false,
  show_vat_estimate BOOLEAN DEFAULT true,
  stripe_fee_estimate_percent NUMERIC DEFAULT 1.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_plan_fee_rules_plan_slug') THEN
    CREATE UNIQUE INDEX idx_plan_fee_rules_plan_slug ON app.plan_fee_rules(plan_slug);
  END IF;
END;
$$;

INSERT INTO app.plan_fee_rules (plan_slug, platform_fee_percent, platform_fee_fixed_pence, stripe_fee_payer, payout_delay_days, dispute_window_hours, auto_release_hours, max_active_jobs, invoice_access, finance_export_access, show_vat_estimate, stripe_fee_estimate_percent)
VALUES
  ('payg',                 10, 0, 'client',     3, 48, 72, 5,  true, false, true, 1.5),
  ('client-starter',        0, 0, 'quickguard', 5, 24, 72, 5,  true, false, true, 1.5),
  ('client-pro',            0, 0, 'quickguard', 3, 48, 72, 20, true, true,  true, 1.5),
  ('client-enterprise',     0, 0, 'quickguard', 1, 72, 72, 100,true, true,  true, 1.5),
  ('guard-starter',         0, 0, 'quickguard', 5, 24, 72, 5,  true, false, true, 1.5),
  ('guard-pro',             0, 0, 'quickguard', 3, 48, 72, 20, true, true,  true, 1.5)
ON CONFLICT (plan_slug) DO UPDATE SET
  platform_fee_percent = EXCLUDED.platform_fee_percent,
  platform_fee_fixed_pence = EXCLUDED.platform_fee_fixed_pence,
  stripe_fee_payer = EXCLUDED.stripe_fee_payer,
  payout_delay_days = EXCLUDED.payout_delay_days,
  dispute_window_hours = EXCLUDED.dispute_window_hours,
  auto_release_hours = EXCLUDED.auto_release_hours,
  max_active_jobs = EXCLUDED.max_active_jobs,
  invoice_access = EXCLUDED.invoice_access,
  finance_export_access = EXCLUDED.finance_export_access,
  show_vat_estimate = EXCLUDED.show_vat_estimate,
  stripe_fee_estimate_percent = EXCLUDED.stripe_fee_estimate_percent,
  updated_at = now();