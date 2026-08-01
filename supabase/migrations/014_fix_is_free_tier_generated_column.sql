-- 014: Fix is_free_tier generated column to use monthly_price_pence = 0
-- Previously: CASE WHEN subscription_status IS NULL THEN true ELSE false END
-- This caused free-tier users with any subscription_status (even 'free') to have is_free_tier=false,
-- which in turn caused check_monthly_usage to use subscription-based period calculation
-- instead of signup-anniversary-based period calculation.

-- 1. Rename the broken generated column so we can add a corrected one
ALTER TABLE app.user_entitlements_data RENAME COLUMN is_free_tier TO is_free_tier_old;

-- 2. Add the corrected generated column: free = price is zero
ALTER TABLE app.user_entitlements_data
ADD COLUMN is_free_tier boolean GENERATED ALWAYS AS (monthly_price_pence = 0) STORED;

-- 3. Recreate the view so it points to the new column
-- (PostgreSQL auto-aliased is_free_tier_old AS is_free_tier during the rename)
CREATE OR REPLACE VIEW app.user_entitlements AS
SELECT 
  user_id,
  plan_slug,
  plan_name,
  audience,
  features,
  monthly_price_pence,
  subscription_status,
  current_period_end,
  cancel_at_period_end,
  is_active,
  is_free_tier,
  stripe_subscription_id,
  created_at,
  updated_at
FROM app.user_entitlements_data ued;

-- 4. Drop the old column now that the view no longer references it
ALTER TABLE app.user_entitlements_data DROP COLUMN is_free_tier_old;