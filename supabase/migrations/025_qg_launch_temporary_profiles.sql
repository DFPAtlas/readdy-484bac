-- 025_qg_launch_temporary_profiles.sql
-- QG Launch Rewards: Temporary Launch Profile System
-- Adds missing columns, indexes, RLS policies

-- Add missing columns to qg_launch_profiles (if not already added)
ALTER TABLE app.qg_launch_profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS location_text text,
ADD COLUMN IF NOT EXISTS sia_licence_type text,
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS qg_terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS qg_terms_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'qg_launch_rewards',
ADD COLUMN IF NOT EXISTS linked_at timestamptz,
ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- New indexes
CREATE INDEX IF NOT EXISTS qg_launch_profiles_referrer_user_id_idx ON app.qg_launch_profiles(referrer_user_id);
CREATE INDEX IF NOT EXISTS qg_launch_profiles_source_idx ON app.qg_launch_profiles(source);

-- Enable RLS on critical token tables
ALTER TABLE app.qg_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_invite_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own referral codes
DROP POLICY IF EXISTS "Users can read their own referral codes" ON app.qg_referral_codes;
CREATE POLICY "Users can read their own referral codes" ON app.qg_referral_codes
  FOR SELECT USING (owner_user_id = auth.uid());

-- RLS: Users can read referrals they created
DROP POLICY IF EXISTS "Users can read their own referrals" ON app.qg_referrals;
CREATE POLICY "Users can read their own referrals" ON app.qg_referrals
  FOR SELECT USING (referrer_user_id = auth.uid());

-- RLS: Users can read their own token ledger
DROP POLICY IF EXISTS "Users can read their own token ledger" ON app.qg_token_ledger;
CREATE POLICY "Users can read their own token ledger" ON app.qg_token_ledger
  FOR SELECT USING (user_id = auth.uid());

-- RLS: Users can read their own redemptions
DROP POLICY IF EXISTS "Users can read their own redemptions" ON app.qg_token_redemptions;
CREATE POLICY "Users can read their own redemptions" ON app.qg_token_redemptions
  FOR SELECT USING (user_id = auth.uid());

-- RLS: Users can read invites they sent
DROP POLICY IF EXISTS "Users can read their own invites" ON app.qg_launch_invites;
CREATE POLICY "Users can read their own invites" ON app.qg_launch_invites
  FOR SELECT USING (sender_user_id = auth.uid());

-- RLS: Users can read their own rate limits
DROP POLICY IF EXISTS "Users can read their own rate limits" ON app.qg_invite_rate_limits;
CREATE POLICY "Users can read their own rate limits" ON app.qg_invite_rate_limits
  FOR SELECT USING (user_id = auth.uid());

-- RLS: Admin/service_role full access on all tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'qg_referrals','qg_referral_codes','qg_token_ledger','qg_token_redemptions',
      'qg_launch_invites','qg_launch_campaigns','qg_fraud_events',
      'qg_launch_reward_settings','qg_launch_reward_audit_log','qg_launch_reward_daily_stats',
      'qg_invite_rate_limits','qg_launch_profiles','qg_pre_account_tokens',
      'qg_launch_updates','qg_launch_public_stats'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON app.%I;', tbl);
    EXECUTE format('CREATE POLICY "Admin full access" ON app.%I FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));', tbl);
  END LOOP;
END $$;

-- Ensure service_role bypasses RLS (default in Supabase)
-- Public can read published launch updates
DROP POLICY IF EXISTS "Public can read published updates" ON app.qg_launch_updates;
CREATE POLICY "Public can read published updates" ON app.qg_launch_updates
  FOR SELECT USING (status = 'published');

-- Public can read public stats
DROP POLICY IF EXISTS "Public can read public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Public can read public stats" ON app.qg_launch_public_stats
  FOR SELECT USING (is_public = true);

-- Public can read active referral codes (needed for ref code validation)
DROP POLICY IF EXISTS "Public can read active referral codes" ON app.qg_referral_codes;
CREATE POLICY "Public can read active referral codes" ON app.qg_referral_codes
  FOR SELECT USING (status = 'active');

-- Public can read programme settings
DROP POLICY IF EXISTS "Public can read settings" ON app.qg_launch_reward_settings;
CREATE POLICY "Public can read settings" ON app.qg_launch_reward_settings
  FOR SELECT USING (true);