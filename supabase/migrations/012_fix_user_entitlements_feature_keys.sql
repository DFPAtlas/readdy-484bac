-- 012_fix_user_entitlements_feature_keys.sql
-- Replace invalid feature keys in existing user_entitlements with valid ones.
-- user_entitlements.features is jsonb, not text[].

-- Fix client_free: replace client.basic_matching + client.email_support with client.view_guard_profiles
UPDATE user_entitlements
SET
  features = '["client.post_job", "client.view_guard_profiles", "client.escrow_payments"]'::jsonb,
  updated_at = now()
WHERE plan_slug = 'client_free'
  AND features::jsonb ? 'client.basic_matching';

-- Fix client-starter: replace human-readable strings with real feature keys
UPDATE user_entitlements
SET
  features = '["client.post_job", "client.view_guard_profiles"]'::jsonb,
  updated_at = now()
WHERE plan_slug = 'client-starter'
  AND features::text LIKE '%Occasional guard bookings%';