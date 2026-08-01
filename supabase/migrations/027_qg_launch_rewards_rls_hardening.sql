-- 027_qg_launch_rewards_rls_hardening.sql
-- QG Launch Rewards: Complete RLS Policy Hardening
-- Run this in Supabase SQL Editor to apply all missing RLS policies
-- Consolidates policies from migrations 025 and 026

-- ============================================================================
-- RLS Enable (ensure all are on — already done, but safe to re-run)
-- ============================================================================
ALTER TABLE app.qg_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_pre_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_invite_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_public_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- qg_referral_codes
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own referral codes" ON app.qg_referral_codes;
CREATE POLICY "Users can read their own referral codes" ON app.qg_referral_codes
  FOR SELECT USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Public can read active referral codes" ON app.qg_referral_codes;
CREATE POLICY "Public can read active referral codes" ON app.qg_referral_codes
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Admin full access referral codes" ON app.qg_referral_codes;
CREATE POLICY "Admin full access referral codes" ON app.qg_referral_codes
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_referrals
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own referrals" ON app.qg_referrals;
CREATE POLICY "Users can read their own referrals" ON app.qg_referrals
  FOR SELECT USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert referrals" ON app.qg_referrals;
CREATE POLICY "Anon can insert referrals" ON app.qg_referrals
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access referrals" ON app.qg_referrals;
CREATE POLICY "Admin full access referrals" ON app.qg_referrals
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_token_ledger
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own token ledger" ON app.qg_token_ledger;
CREATE POLICY "Users can read their own token ledger" ON app.qg_token_ledger
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access token ledger" ON app.qg_token_ledger;
CREATE POLICY "Admin full access token ledger" ON app.qg_token_ledger
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_token_redemptions
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own redemptions" ON app.qg_token_redemptions;
CREATE POLICY "Users can read their own redemptions" ON app.qg_token_redemptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access redemptions" ON app.qg_token_redemptions;
CREATE POLICY "Admin full access redemptions" ON app.qg_token_redemptions
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_invites
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own invites" ON app.qg_launch_invites;
CREATE POLICY "Users can read their own invites" ON app.qg_launch_invites
  FOR SELECT USING (sender_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access invites" ON app.qg_launch_invites;
CREATE POLICY "Admin full access invites" ON app.qg_launch_invites
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_campaigns
-- ============================================================================
DROP POLICY IF EXISTS "Public can read published campaigns" ON app.qg_launch_campaigns;
CREATE POLICY "Public can read published campaigns" ON app.qg_launch_campaigns
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Admin full access campaigns" ON app.qg_launch_campaigns;
CREATE POLICY "Admin full access campaigns" ON app.qg_launch_campaigns
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_fraud_events
-- ============================================================================
DROP POLICY IF EXISTS "Admin full access fraud events" ON app.qg_fraud_events;
CREATE POLICY "Admin full access fraud events" ON app.qg_fraud_events
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_reward_settings
-- ============================================================================
DROP POLICY IF EXISTS "Public can read settings" ON app.qg_launch_reward_settings;
CREATE POLICY "Public can read settings" ON app.qg_launch_reward_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full access settings" ON app.qg_launch_reward_settings;
CREATE POLICY "Admin full access settings" ON app.qg_launch_reward_settings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_reward_audit_log
-- ============================================================================
DROP POLICY IF EXISTS "Admin full access audit log" ON app.qg_launch_reward_audit_log;
CREATE POLICY "Admin full access audit log" ON app.qg_launch_reward_audit_log
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_reward_daily_stats
-- ============================================================================
DROP POLICY IF EXISTS "Admin full access daily stats" ON app.qg_launch_reward_daily_stats;
CREATE POLICY "Admin full access daily stats" ON app.qg_launch_reward_daily_stats
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_invite_rate_limits
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own rate limits" ON app.qg_invite_rate_limits;
CREATE POLICY "Users can read their own rate limits" ON app.qg_invite_rate_limits
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access rate limits" ON app.qg_invite_rate_limits;
CREATE POLICY "Admin full access rate limits" ON app.qg_invite_rate_limits
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- qg_launch_profiles
-- ============================================================================
DROP POLICY IF EXISTS "Users read own launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Users read own launch profile" ON app.qg_launch_profiles
  FOR SELECT TO authenticated USING (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Anon can insert launch profile" ON app.qg_launch_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Users update own launch profile" ON app.qg_launch_profiles
  FOR UPDATE TO authenticated USING (linked_user_id = auth.uid()) WITH CHECK (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access launch profiles" ON app.qg_launch_profiles;
CREATE POLICY "Admin full access launch profiles" ON app.qg_launch_profiles
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role manages launch profiles" ON app.qg_launch_profiles;
CREATE POLICY "Service role manages launch profiles" ON app.qg_launch_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- qg_launch_updates
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read published updates" ON app.qg_launch_updates;
CREATE POLICY "Anyone can read published updates" ON app.qg_launch_updates
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Public can read published updates" ON app.qg_launch_updates;
CREATE POLICY "Public can read published updates" ON app.qg_launch_updates
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Admin full access launch updates" ON app.qg_launch_updates;
CREATE POLICY "Admin full access launch updates" ON app.qg_launch_updates
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role manages updates" ON app.qg_launch_updates;
CREATE POLICY "Service role manages updates" ON app.qg_launch_updates
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- qg_launch_public_stats
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Anyone can read public stats" ON app.qg_launch_public_stats
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Public can read public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Public can read public stats" ON app.qg_launch_public_stats
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Admin full access public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Admin full access public stats" ON app.qg_launch_public_stats
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role manages public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Service role manages public stats" ON app.qg_launch_public_stats
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- qg_pre_account_tokens
-- ============================================================================
DROP POLICY IF EXISTS "Users read own pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Users read own pre-account tokens" ON app.qg_pre_account_tokens
  FOR SELECT TO authenticated USING (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Anon can insert pre-account tokens" ON app.qg_pre_account_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Admin full access pre-account tokens" ON app.qg_pre_account_tokens
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================================
-- Verify all tables have RLS enabled
-- ============================================================================
DO $$
DECLARE
  tbl text;
  rls_on boolean;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'qg_referral_codes','qg_referrals','qg_token_ledger','qg_token_redemptions',
      'qg_launch_invites','qg_launch_campaigns','qg_fraud_events',
      'qg_launch_reward_settings','qg_launch_reward_audit_log','qg_launch_reward_daily_stats',
      'qg_invite_rate_limits','qg_launch_profiles','qg_pre_account_tokens',
      'qg_launch_updates','qg_launch_public_stats'
    ])
  LOOP
    SELECT rowsecurity INTO rls_on FROM pg_tables WHERE schemaname = 'app' AND tablename = tbl;
    IF rls_on IS NOT TRUE THEN
      RAISE EXCEPTION 'RLS is OFF on app.%', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'All 15 QG tables have RLS enabled.';
END $$;