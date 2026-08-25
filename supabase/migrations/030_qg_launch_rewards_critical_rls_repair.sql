-- ============================================================================
-- 030_qg_launch_rewards_critical_rls_repair.sql
-- QuickGuard Launch Rewards — Critical RLS Emergency Repair
--
-- Rebuilds Row Level Security for the 16 Launch Rewards tables.
--
-- Fixes:
--   * Weak "Admin full access ..." policies applied to PUBLIC (no is_active,
--     no schema qualification, no role restriction).
--   * Direct anonymous INSERT policies on referrals / launch profiles /
--     pre-account tokens.
--   * Direct authenticated UPDATE policy on launch profiles (ownership risk).
--   * Duplicate / invalid public SELECT policies (campaigns have no
--     'published' status).
--   * RLS disabled on app.email_suppression_list.
--   * Owner SELECT policies incorrectly targeting PUBLIC.
--   * Unrestricted public read of the full launch reward settings table.
--
-- This migration is:
--   * Forward-only
--   * Idempotent (all drops use IF EXISTS, safe to re-run)
--   * Non-destructive (no table/column changes, no data changes)
--   * Transactional
--
-- IMPORTANT: The live frontend now reads public launch settings through the
-- `qg-public-launch-settings` Edge Function (an explicit whitelist), not via
-- a raw public table read. No "Public can read settings" policy is recreated.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Enable RLS on every audited table (including the previously disabled
--    email_suppression_list).
-- ============================================================================
ALTER TABLE app.qg_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_invite_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_public_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_pre_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Drop unsafe / obsolete policies (both legacy and current names).
-- ============================================================================

-- (a) Weak "Admin full access ..." policies (PUBLIC + no is_active/schema/role)
DROP POLICY IF EXISTS "Admin full access referral codes" ON app.qg_referral_codes;
DROP POLICY IF EXISTS "Admin full access referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Admin full access token ledger" ON app.qg_token_ledger;
DROP POLICY IF EXISTS "Admin full access redemptions" ON app.qg_token_redemptions;
DROP POLICY IF EXISTS "Admin full access settings" ON app.qg_launch_reward_settings;
DROP POLICY IF EXISTS "Admin full access invites" ON app.qg_launch_invites;
DROP POLICY IF EXISTS "Admin full access campaigns" ON app.qg_launch_campaigns;
DROP POLICY IF EXISTS "Admin full access rate limits" ON app.qg_invite_rate_limits;
DROP POLICY IF EXISTS "Admin full access launch profiles" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Admin full access launch updates" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Admin full access public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Admin full access pre-account tokens" ON app.qg_pre_account_tokens;
DROP POLICY IF EXISTS "Admin full access fraud events" ON app.qg_fraud_events;
DROP POLICY IF EXISTS "Admin full access daily stats" ON app.qg_launch_reward_daily_stats;
DROP POLICY IF EXISTS "Admin full access audit log" ON app.qg_launch_reward_audit_log;

-- Generic "Admin full access" (migration 025) on every audited table
DROP POLICY IF EXISTS "Admin full access" ON app.qg_referral_codes;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_referrals;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_token_ledger;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_token_redemptions;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_reward_settings;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_invites;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_campaigns;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_invite_rate_limits;
DROP POLICY IF EXISTS "Admin full access" ON app.email_suppression_list;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_pre_account_tokens;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_fraud_events;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_reward_daily_stats;
DROP POLICY IF EXISTS "Admin full access" ON app.qg_launch_reward_audit_log;

-- (b) Service-role policies (recreate with a consistent explicit role target)
DROP POLICY IF EXISTS "Service role manages referral codes" ON app.qg_referral_codes;
DROP POLICY IF EXISTS "Service role manages referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Service role manages ledger" ON app.qg_token_ledger;
DROP POLICY IF EXISTS "Service role manages token ledger" ON app.qg_token_ledger;
DROP POLICY IF EXISTS "Service role manages redemptions" ON app.qg_token_redemptions;
DROP POLICY IF EXISTS "Service role manages token redemptions" ON app.qg_token_redemptions;
DROP POLICY IF EXISTS "Service role manages settings" ON app.qg_launch_reward_settings;
DROP POLICY IF EXISTS "Service role manages launch reward settings" ON app.qg_launch_reward_settings;
DROP POLICY IF EXISTS "Service role manages invites" ON app.qg_launch_invites;
DROP POLICY IF EXISTS "Service role manages launch invites" ON app.qg_launch_invites;
DROP POLICY IF EXISTS "Service role manages campaigns" ON app.qg_launch_campaigns;
DROP POLICY IF EXISTS "Service role manages launch campaigns" ON app.qg_launch_campaigns;
DROP POLICY IF EXISTS "Service role manages rate limits" ON app.qg_invite_rate_limits;
DROP POLICY IF EXISTS "Service role manages invite rate limits" ON app.qg_invite_rate_limits;
DROP POLICY IF EXISTS "Service role manages suppression" ON app.email_suppression_list;
DROP POLICY IF EXISTS "Service role manages email suppression list" ON app.email_suppression_list;
DROP POLICY IF EXISTS "Service role manages launch profiles" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Service role manages updates" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Service role manages launch updates" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Service role manages public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Service role manages launch public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Service role manages pre-account tokens" ON app.qg_pre_account_tokens;
DROP POLICY IF EXISTS "Service role manages fraud events" ON app.qg_fraud_events;
DROP POLICY IF EXISTS "Service role manages daily stats" ON app.qg_launch_reward_daily_stats;
DROP POLICY IF EXISTS "Service role manages launch reward daily stats" ON app.qg_launch_reward_daily_stats;
DROP POLICY IF EXISTS "Service role manages audit log" ON app.qg_launch_reward_audit_log;
DROP POLICY IF EXISTS "Service role manages launch reward audit log" ON app.qg_launch_reward_audit_log;

-- (c) Anonymous / direct INSERT policies
DROP POLICY IF EXISTS "Anon can insert referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Anon can insert launch profile" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Anon can insert pre-account tokens" ON app.qg_pre_account_tokens;
DROP POLICY IF EXISTS "Disabled: anon insert referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Disabled: anon insert launch profile" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Disabled: anon insert pre-account tokens" ON app.qg_pre_account_tokens;

-- (d) Unsafe direct profile update
DROP POLICY IF EXISTS "Users update own launch profile" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Disabled: launch profile owner update" ON app.qg_launch_profiles;

-- (e) Duplicate / invalid public SELECT policies
DROP POLICY IF EXISTS "Anyone can read published updates" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Public can read published updates" ON app.qg_launch_updates;
DROP POLICY IF EXISTS "Anyone can read public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Public can read public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Public can read published campaigns" ON app.qg_launch_campaigns;

-- (f) Unrestricted public settings read (now served by qg-public-launch-settings)
DROP POLICY IF EXISTS "Public can read settings" ON app.qg_launch_reward_settings;

-- (g) Owner SELECT policies (recreated below targeting authenticated)
DROP POLICY IF EXISTS "Users can read their own referral codes" ON app.qg_referral_codes;
DROP POLICY IF EXISTS "Users can read their own referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Users can read their own token ledger" ON app.qg_token_ledger;
DROP POLICY IF EXISTS "Users can read their own redemptions" ON app.qg_token_redemptions;
DROP POLICY IF EXISTS "Users can read their own invites" ON app.qg_launch_invites;
DROP POLICY IF EXISTS "Users can read their own rate limits" ON app.qg_invite_rate_limits;
DROP POLICY IF EXISTS "Users read own launch profile" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Users read own pre-account tokens" ON app.qg_pre_account_tokens;

-- (h) Public active referral code read (recreated below)
DROP POLICY IF EXISTS "Public can read active referral codes" ON app.qg_referral_codes;

-- (i) Legacy referral-code creation (recreated below)
DROP POLICY IF EXISTS "Users create own referral code" ON app.qg_referral_codes;

-- (j) Audit-log admin SELECT (recreated below with super_admin restriction)
DROP POLICY IF EXISTS "Active admins read launch reward audit log" ON app.qg_launch_reward_audit_log;
DROP POLICY IF EXISTS "Active super admins read launch reward audit log" ON app.qg_launch_reward_audit_log;

-- ============================================================================
-- 3. Recreate hardened policies.
--    super_admin predicate (schema-qualified, active only, super_admin only).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- qg_referral_codes
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages referral codes"
  ON app.qg_referral_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage referral codes"
  ON app.qg_referral_codes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own referral codes"
  ON app.qg_referral_codes
  FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "Public can read active referral codes"
  ON app.qg_referral_codes
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users create own referral code"
  ON app.qg_referral_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = (SELECT auth.uid())
    AND owner_role IN ('guard', 'client')
    AND status = 'active'
  );

-- ---------------------------------------------------------------------------
-- qg_referrals
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages referrals"
  ON app.qg_referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage referrals"
  ON app.qg_referrals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own referrals"
  ON app.qg_referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_token_ledger
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages token ledger"
  ON app.qg_token_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage token ledger"
  ON app.qg_token_ledger
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own token ledger"
  ON app.qg_token_ledger
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_token_redemptions
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages token redemptions"
  ON app.qg_token_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage token redemptions"
  ON app.qg_token_redemptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own redemptions"
  ON app.qg_token_redemptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_launch_reward_settings
--   NOTE: no public read policy. Public settings are served by the
--   qg-public-launch-settings Edge Function whitelist.
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch reward settings"
  ON app.qg_launch_reward_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch reward settings"
  ON app.qg_launch_reward_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- qg_launch_invites
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch invites"
  ON app.qg_launch_invites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch invites"
  ON app.qg_launch_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own invites"
  ON app.qg_launch_invites
  FOR SELECT TO authenticated
  USING (sender_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_launch_campaigns
--   NOTE: no public read policy. Campaigns have no 'published' status.
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch campaigns"
  ON app.qg_launch_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch campaigns"
  ON app.qg_launch_campaigns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- qg_invite_rate_limits
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages invite rate limits"
  ON app.qg_invite_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage invite rate limits"
  ON app.qg_invite_rate_limits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users can read their own rate limits"
  ON app.qg_invite_rate_limits
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- email_suppression_list
--   No anonymous or normal-user access. super_admin + service_role only.
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages email suppression list"
  ON app.email_suppression_list
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage email suppression list"
  ON app.email_suppression_list
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- qg_launch_profiles
--   No direct user UPDATE — profile writes flow through the service-role
--   Edge Function.
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch profiles"
  ON app.qg_launch_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch profiles"
  ON app.qg_launch_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users read own launch profile"
  ON app.qg_launch_profiles
  FOR SELECT TO authenticated
  USING (linked_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_launch_updates
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch updates"
  ON app.qg_launch_updates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch updates"
  ON app.qg_launch_updates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Public can read published updates"
  ON app.qg_launch_updates
  FOR SELECT USING (status = 'published');

-- ---------------------------------------------------------------------------
-- qg_launch_public_stats
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch public stats"
  ON app.qg_launch_public_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch public stats"
  ON app.qg_launch_public_stats
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Public can read public stats"
  ON app.qg_launch_public_stats
  FOR SELECT USING (is_public IS TRUE);

-- ---------------------------------------------------------------------------
-- qg_pre_account_tokens
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages pre-account tokens"
  ON app.qg_pre_account_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage pre-account tokens"
  ON app.qg_pre_account_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Users read own pre-account tokens"
  ON app.qg_pre_account_tokens
  FOR SELECT TO authenticated
  USING (linked_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- qg_fraud_events
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages fraud events"
  ON app.qg_fraud_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage fraud events"
  ON app.qg_fraud_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- qg_launch_reward_daily_stats
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch reward daily stats"
  ON app.qg_launch_reward_daily_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins manage launch reward daily stats"
  ON app.qg_launch_reward_daily_stats
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- qg_launch_reward_audit_log
--   Append-only for non-service-role. super_admin may SELECT only.
-- ---------------------------------------------------------------------------
CREATE POLICY "Service role manages launch reward audit log"
  ON app.qg_launch_reward_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Active super admins read launch reward audit log"
  ON app.qg_launch_reward_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users AS au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active IS TRUE
        AND au.role = 'super_admin'
    )
  );

-- ============================================================================
-- 4. Non-destructive verification (warns, does not roll back).
-- ============================================================================
DO $$
DECLARE
  unsafe_count integer;
BEGIN
  SELECT count(*) INTO unsafe_count
  FROM pg_policies
  WHERE schemaname = 'app'
    AND tablename IN (
      'qg_referral_codes','qg_referrals','qg_token_ledger',
      'qg_token_redemptions','qg_launch_reward_settings',
      'qg_launch_invites','qg_launch_campaigns',
      'qg_invite_rate_limits','email_suppression_list',
      'qg_launch_profiles','qg_launch_updates',
      'qg_launch_public_stats','qg_pre_account_tokens',
      'qg_fraud_events','qg_launch_reward_daily_stats',
      'qg_launch_reward_audit_log'
    )
    AND cmd = 'ALL'
    AND roles && ARRAY['public','anon','authenticated']::name[]
    AND (qual = 'true' OR with_check = 'true');

  IF unsafe_count > 0 THEN
    RAISE WARNING 'Unsafe broad ALL policies remain: %', unsafe_count;
  ELSE
    RAISE NOTICE 'RLS repair verification passed: no unsafe broad ALL policies remain.';
  END IF;
END $$;

COMMIT;