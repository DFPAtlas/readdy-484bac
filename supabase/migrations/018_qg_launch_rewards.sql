-- ============================================================================
-- QG Launch Rewards — Referral & Token System
-- Migration: 018_qg_launch_rewards
-- ============================================================================

-- 1. Referral Codes
CREATE TABLE IF NOT EXISTS app.qg_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_role text CHECK (owner_role IN ('guard','client','admin','launch_partner')),
  code text UNIQUE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Referrals
CREATE TABLE IF NOT EXISTS app.qg_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid REFERENCES app.qg_referral_codes(id) ON DELETE SET NULL,
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  referred_role text CHECK (referred_role IN ('guard','client')),
  status text DEFAULT 'clicked' CHECK (status IN ('clicked','profile_started','account_created','verified','approved','cancelled','rejected')),
  source text DEFAULT 'qg_launch_rewards',
  landing_path text,
  ip_hash text,
  user_agent_hash text,
  fraud_flags jsonb DEFAULT '[]'::jsonb,
  pending_tokens integer DEFAULT 0,
  approved_tokens integer DEFAULT 0,
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Token Ledger
CREATE TABLE IF NOT EXISTS app.qg_token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text CHECK (event_type IN ('profile_bonus','referral_pending','referral_approved','manual_adjustment','redemption_pending','redemption_confirmed','redemption_cancelled','clawback','expiry')),
  tokens integer NOT NULL,
  balance_after integer,
  status text DEFAULT 'approved' CHECK (status IN ('pending','approved','cancelled','used','expired')),
  related_referral_id uuid REFERENCES app.qg_referrals(id) ON DELETE SET NULL,
  stripe_checkout_session_id text,
  stripe_coupon_id text,
  admin_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Token Redemptions
CREATE TABLE IF NOT EXISTS app.qg_token_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL,
  credit_pence integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','failed')),
  stripe_checkout_session_id text,
  stripe_coupon_id text,
  plan_slug text,
  account_type text CHECK (account_type IN ('guard','client')),
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

-- 5. Settings
CREATE TABLE IF NOT EXISTS app.qg_launch_reward_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed settings
INSERT INTO app.qg_launch_reward_settings (key, value) VALUES
  ('token_value_pence_per_100', '1000'),
  ('profile_completion_bonus_tokens', '50'),
  ('verified_guard_referral_tokens', '250'),
  ('verified_client_referral_tokens', '500'),
  ('max_redemption_percent_per_invoice', '50'),
  ('token_expiry_months', '12'),
  ('programme_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qg_referral_codes_code ON app.qg_referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_qg_referrals_referrer ON app.qg_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_qg_referrals_referred ON app.qg_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_qg_token_ledger_user ON app.qg_token_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_qg_token_redemptions_user ON app.qg_token_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_qg_token_redemptions_session ON app.qg_token_redemptions(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_qg_referrals_status ON app.qg_referrals(status);
CREATE INDEX IF NOT EXISTS idx_qg_referral_codes_owner ON app.qg_referral_codes(owner_user_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE app.qg_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_token_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_settings ENABLE ROW LEVEL SECURITY;

-- QG Referral Codes
DROP POLICY IF EXISTS "Users can view own referral code" ON app.qg_referral_codes;
CREATE POLICY "Users can view own referral code" ON app.qg_referral_codes
  FOR SELECT USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages referral codes" ON app.qg_referral_codes;
CREATE POLICY "Service role manages referral codes" ON app.qg_referral_codes
  FOR ALL USING (true) WITH CHECK (true);

-- QG Referrals
DROP POLICY IF EXISTS "Users can view own referrals" ON app.qg_referrals;
CREATE POLICY "Users can view own referrals" ON app.qg_referrals
  FOR SELECT USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages referrals" ON app.qg_referrals;
CREATE POLICY "Service role manages referrals" ON app.qg_referrals
  FOR ALL USING (true) WITH CHECK (true);

-- QG Token Ledger
DROP POLICY IF EXISTS "Users can view own ledger" ON app.qg_token_ledger;
CREATE POLICY "Users can view own ledger" ON app.qg_token_ledger
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages ledger" ON app.qg_token_ledger;
CREATE POLICY "Service role manages ledger" ON app.qg_token_ledger
  FOR ALL USING (true) WITH CHECK (true);

-- QG Token Redemptions
DROP POLICY IF EXISTS "Users can view own redemptions" ON app.qg_token_redemptions;
CREATE POLICY "Users can view own redemptions" ON app.qg_token_redemptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages redemptions" ON app.qg_token_redemptions;
CREATE POLICY "Service role manages redemptions" ON app.qg_token_redemptions
  FOR ALL USING (true) WITH CHECK (true);

-- QG Launch Reward Settings
DROP POLICY IF EXISTS "Anyone can view settings" ON app.qg_launch_reward_settings;
CREATE POLICY "Anyone can view settings" ON app.qg_launch_reward_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages settings" ON app.qg_launch_reward_settings;
CREATE POLICY "Service role manages settings" ON app.qg_launch_reward_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Helper SQL Functions
-- ============================================================================

-- Get approved token balance
CREATE OR REPLACE FUNCTION app.get_qg_token_balance(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_approved integer;
  total_used integer;
BEGIN
  SELECT COALESCE(SUM(tokens), 0) INTO total_approved
  FROM app.qg_token_ledger
  WHERE user_id = user_uuid
    AND status = 'approved'
    AND event_type IN ('profile_bonus','referral_approved','manual_adjustment');

  SELECT COALESCE(SUM(tokens_used), 0) INTO total_used
  FROM app.qg_token_redemptions
  WHERE user_id = user_uuid
    AND status IN ('pending','confirmed');

  RETURN GREATEST(total_approved - total_used, 0);
END;
$$;

-- Generate a unique referral code
CREATE OR REPLACE FUNCTION app.generate_qg_referral_code(user_uuid uuid, role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  name_part text;
  code text;
  attempts integer := 0;
BEGIN
  IF role = 'guard' THEN
    SELECT COALESCE(
      regexp_replace(upper(full_name), '[^A-Z0-9]', '', 'g'),
      ''
    ) INTO name_part
    FROM app.guards WHERE user_id = user_uuid;
  ELSE
    SELECT COALESCE(
      regexp_replace(upper(contact_name), '[^A-Z0-9]', '', 'g'),
      ''
    ) INTO name_part
    FROM app.clients WHERE user_id = user_uuid;
  END IF;

  IF name_part IS NULL OR length(name_part) = 0 THEN
    name_part := '';
  END IF;

  IF length(name_part) > 12 THEN
    name_part := substring(name_part, 1, 12);
  END IF;

  LOOP
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 10 attempts';
    END IF;

    IF name_part <> '' THEN
      code := 'QG-' || name_part || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    ELSE
      code := 'QG-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM app.qg_referral_codes WHERE code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Approve a referral
CREATE OR REPLACE FUNCTION app.approve_qg_referral(referral_uuid uuid, admin_uuid uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref_record app.qg_referrals%ROWTYPE;
  settings_record RECORD;
  token_amount integer;
BEGIN
  SELECT * INTO ref_record FROM app.qg_referrals WHERE id = referral_uuid;

  IF ref_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF ref_record.referrer_user_id = ref_record.referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Self-referral not allowed');
  END IF;

  IF ref_record.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral already approved');
  END IF;

  IF ref_record.status != 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral must be verified before approval');
  END IF;

  IF ref_record.fraud_flags IS NOT NULL AND jsonb_array_length(ref_record.fraud_flags) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral has active fraud flags');
  END IF;

  IF ref_record.referred_role = 'guard' THEN
    token_amount := 250;
  ELSIF ref_record.referred_role = 'client' THEN
    token_amount := 500;
  ELSE
    token_amount := 0;
  END IF;

  UPDATE app.qg_referrals
  SET status = 'approved',
      approved_tokens = token_amount,
      approved_at = now(),
      updated_at = now()
  WHERE id = referral_uuid;

  INSERT INTO app.qg_token_ledger (user_id, event_type, tokens, status, related_referral_id, created_by)
  VALUES (ref_record.referrer_user_id, 'referral_approved', token_amount, 'approved', referral_uuid, admin_uuid);

  RETURN jsonb_build_object('success', true, 'tokens', token_amount, 'referrer_id', ref_record.referrer_user_id);
END;
$$;