-- QG Launch Rewards Phase 6: Launch Account Dashboard
-- Migration: 026_qg_launch_account_dashboard

-- ============================================================================
-- Tables
-- ============================================================================

-- Launch Profiles: temporary profile for launch users before full account
CREATE TABLE IF NOT EXISTS app.qg_launch_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalised text NOT NULL,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  intended_role text DEFAULT 'unknown',
  profile_status text DEFAULT 'temporary',
  referral_code text,
  newsletter_consent boolean DEFAULT false,
  newsletter_consent_at timestamptz,
  last_account_viewed_at timestamptz,
  converted_to text,
  converted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Launch Updates: newsletter-style update cards
CREATE TABLE IF NOT EXISTS app.qg_launch_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  body text,
  status text DEFAULT 'draft',
  audience text DEFAULT 'all',
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Public Launch Stats
CREATE TABLE IF NOT EXISTS app.qg_launch_public_stats (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  is_public boolean DEFAULT false,
  label text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Constraints
-- ============================================================================

ALTER TABLE app.qg_launch_profiles DROP CONSTRAINT IF EXISTS chk_lp_intended_role;
ALTER TABLE app.qg_launch_profiles ADD CONSTRAINT chk_lp_intended_role CHECK (intended_role IN ('guard','client','both','unsure','unknown'));

ALTER TABLE app.qg_launch_profiles DROP CONSTRAINT IF EXISTS chk_lp_profile_status;
ALTER TABLE app.qg_launch_profiles ADD CONSTRAINT chk_lp_profile_status CHECK (profile_status IN ('temporary','linked','converted_guard','converted_client','verified'));

ALTER TABLE app.qg_launch_updates DROP CONSTRAINT IF EXISTS chk_lu_status;
ALTER TABLE app.qg_launch_updates ADD CONSTRAINT chk_lu_status CHECK (status IN ('draft','published','archived'));

ALTER TABLE app.qg_launch_updates DROP CONSTRAINT IF EXISTS chk_lu_audience;
ALTER TABLE app.qg_launch_updates ADD CONSTRAINT chk_lu_audience CHECK (audience IN ('all','guards','clients','both'));

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lp_email_norm ON app.qg_launch_profiles(email_normalised);
CREATE INDEX IF NOT EXISTS idx_lp_linked_user ON app.qg_launch_profiles(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_lp_referral_code ON app.qg_launch_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_lp_profile_status ON app.qg_launch_profiles(profile_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_email_unique_active ON app.qg_launch_profiles(email_normalised) WHERE profile_status IN ('temporary','linked');

CREATE INDEX IF NOT EXISTS idx_lu_status ON app.qg_launch_updates(status);
CREATE INDEX IF NOT EXISTS idx_lu_published_at ON app.qg_launch_updates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_lu_audience ON app.qg_launch_updates(audience);

-- ============================================================================
-- Seed Data
-- ============================================================================

INSERT INTO app.qg_launch_public_stats (key, value, is_public, label) VALUES
  ('total_launch_members', '0', true, 'Total Launch Members'),
  ('total_guard_interest', '0', true, 'Guards Interested'),
  ('total_client_interest', '0', true, 'Clients Interested'),
  ('total_verified_guards', '0', true, 'Verified Guards'),
  ('total_businesses_joined', '0', true, 'Businesses Joined'),
  ('total_qg_tokens_issued', '0', true, 'QG Tokens Issued'),
  ('latest_launch_milestone', '"QuickGuard launch rewards programme is now live. Early access is opening in phases."', true, 'Latest Milestone')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app.qg_launch_updates (title, summary, body, status, audience, published_at)
VALUES
  ('Guard onboarding is opening soon', 'We are preparing to open guard onboarding for the QuickGuard launch. Verified guards will be the first to access the full platform.', '<p>QuickGuard is getting ready to welcome the first cohort of verified security guards. If you have completed your SIA licence verification and profile setup, your account will be prioritised for early access.</p><p>QG Tokens earned during the launch phase will become usable for platform discounts once your full guard account is active.</p>', 'published', 'guards', now()),
  ('Client early access is being prepared', 'Businesses that joined during the launch phase will get priority access to post jobs and hire verified guards.', '<p>We are building the client dashboard and job posting tools. Businesses that registered interest during the QG Launch Rewards phase will receive early access invitations.</p>', 'published', 'clients', now()),
  ('QG Tokens are now being tracked under launch accounts', 'Your QG Tokens are stored against your email address and will link automatically when you create your full QuickGuard account.', '<p>We have launched the QG Launch Account system. Every QG Token you earn through referrals and profile completion is tracked against your email address.</p><p>When you create your full QuickGuard account using the same email, your tokens will link automatically and become visible in your dashboard.</p>', 'published', 'all', now())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE app.qg_launch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_public_stats ENABLE ROW LEVEL SECURITY;

-- Launch Profiles
DROP POLICY IF EXISTS "Users read own launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Users read own launch profile" ON app.qg_launch_profiles
  FOR SELECT TO authenticated USING (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Anon can insert launch profile" ON app.qg_launch_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own launch profile" ON app.qg_launch_profiles;
CREATE POLICY "Users update own launch profile" ON app.qg_launch_profiles
  FOR UPDATE TO authenticated USING (linked_user_id = auth.uid()) WITH CHECK (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages launch profiles" ON app.qg_launch_profiles;
CREATE POLICY "Service role manages launch profiles" ON app.qg_launch_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Launch Updates
DROP POLICY IF EXISTS "Anyone can read published updates" ON app.qg_launch_updates;
CREATE POLICY "Anyone can read published updates" ON app.qg_launch_updates
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Service role manages updates" ON app.qg_launch_updates;
CREATE POLICY "Service role manages updates" ON app.qg_launch_updates
  FOR ALL USING (true) WITH CHECK (true);

-- Public Stats
DROP POLICY IF EXISTS "Anyone can read public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Anyone can read public stats" ON app.qg_launch_public_stats
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Service role manages public stats" ON app.qg_launch_public_stats;
CREATE POLICY "Service role manages public stats" ON app.qg_launch_public_stats
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Helper Function
-- ============================================================================

CREATE OR REPLACE FUNCTION app.get_qg_launch_account_dashboard(identifier_email text, identifier_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_normalised text;
  v_profile record;
  v_tokens record;
  v_referral_count integer;
  v_clicked_count integer;
  v_signed_up_count integer;
  v_verified_count integer;
  v_ref_pending_tokens integer;
  v_ref_approved_tokens integer;
  v_invites_sent integer;
  v_updates jsonb;
  v_stats jsonb;
  v_checklist jsonb;
  v_credit_estimate numeric;
BEGIN
  v_normalised := lower(trim(identifier_email));

  SELECT * INTO v_profile
  FROM app.qg_launch_profiles
  WHERE email_normalised = v_normalised
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT * INTO v_tokens
  FROM app.qg_pre_account_tokens
  WHERE email_normalised = v_normalised
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_referral_count
  FROM app.qg_referrals
  WHERE referral_code_id IN (
    SELECT id FROM app.qg_referral_codes WHERE code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '')
  );

  SELECT COUNT(*) INTO v_clicked_count
  FROM app.qg_referrals
  WHERE referral_code_id IN (
    SELECT id FROM app.qg_referral_codes WHERE code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '')
  ) AND status IN ('clicked','profile_started','account_created','verified','approved');

  SELECT COUNT(*) INTO v_signed_up_count
  FROM app.qg_referrals
  WHERE referral_code_id IN (
    SELECT id FROM app.qg_referral_codes WHERE code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '')
  ) AND status IN ('profile_started','account_created','verified','approved');

  SELECT COUNT(*) INTO v_verified_count
  FROM app.qg_referrals
  WHERE referral_code_id IN (
    SELECT id FROM app.qg_referral_codes WHERE code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '')
  ) AND status IN ('verified','approved');

  SELECT
    COALESCE(SUM(COALESCE(pending_tokens, 0)), 0),
    COALESCE(SUM(COALESCE(approved_tokens, 0)), 0)
  INTO v_ref_pending_tokens, v_ref_approved_tokens
  FROM app.qg_referrals
  WHERE referral_code_id IN (
    SELECT id FROM app.qg_referral_codes WHERE code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '')
  );

  SELECT COUNT(*) INTO v_invites_sent
  FROM app.qg_launch_invites
  WHERE referral_code = COALESCE(v_profile.referral_code, v_tokens.referral_code, '');

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'summary', summary,
      'published_at', published_at
    ) ORDER BY published_at DESC
  ) FILTER (WHERE id IS NOT NULL), '[]'::jsonb) INTO v_updates
  FROM app.qg_launch_updates
  WHERE status = 'published'
    AND (audience = 'all' OR audience = COALESCE(v_profile.intended_role, 'all') OR audience = 'both')
  LIMIT 3;

  BEGIN
    SELECT jsonb_object_agg(key, value) INTO v_stats
    FROM app.qg_launch_public_stats
    WHERE is_public = true;
  EXCEPTION WHEN OTHERS THEN
    v_stats := ''::jsonb;
  END;

  IF v_stats IS NULL THEN
    v_stats := ''::jsonb;
  END IF;

  v_credit_estimate := ROUND((COALESCE(v_tokens.pending_tokens, 0) + COALESCE(v_tokens.approved_tokens, 0)) * 10.0 / 100.0, 2);

  v_checklist := jsonb_build_object(
    'email_added', true,
    'profile_created', v_profile.id IS NOT NULL,
    'referral_code_created', COALESCE(v_profile.referral_code, v_tokens.referral_code) IS NOT NULL,
    'first_recommendation_sent', v_invites_sent > 0 OR v_referral_count > 0,
    'full_account_created', v_profile.linked_user_id IS NOT NULL,
    'account_verified', v_tokens.status = 'verified',
    'tokens_approved', COALESCE(v_tokens.approved_tokens, 0) > 0
  );

  RETURN jsonb_build_object(
    'profile', CASE WHEN v_profile.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_profile.id,
        'email', v_profile.email,
        'name', v_profile.name,
        'intended_role', v_profile.intended_role,
        'profile_status', v_profile.profile_status,
        'referral_code', v_profile.referral_code,
        'newsletter_consent', COALESCE(v_profile.newsletter_consent, false),
        'created_at', v_profile.created_at
      ) ELSE NULL END,
    'tokens', CASE WHEN v_tokens.id IS NOT NULL THEN
      jsonb_build_object(
        'pending_tokens', COALESCE(v_tokens.pending_tokens, 0),
        'approved_tokens', COALESCE(v_tokens.approved_tokens, 0),
        'cancelled_tokens', COALESCE(v_tokens.cancelled_tokens, 0),
        'total_tokens', COALESCE(v_tokens.pending_tokens, 0) + COALESCE(v_tokens.approved_tokens, 0),
        'status', v_tokens.status,
        'intended_role', v_tokens.intended_role,
        'referral_code', v_tokens.referral_code
      ) ELSE jsonb_build_object(
        'pending_tokens', 0,
        'approved_tokens', 0,
        'cancelled_tokens', 0,
        'total_tokens', 0,
        'status', 'none',
        'intended_role', 'unknown',
        'referral_code', null
      ) END,
    'credit_estimate_pounds', v_credit_estimate,
    'referral_code', COALESCE(v_profile.referral_code, v_tokens.referral_code),
    'referral_link', CASE WHEN COALESCE(v_profile.referral_code, v_tokens.referral_code) IS NOT NULL THEN '/qg-launch-rewards?ref=' || COALESCE(v_profile.referral_code, v_tokens.referral_code) ELSE '' END,
    'referral_stats', jsonb_build_object(
      'total_sent', v_referral_count + v_invites_sent,
      'clicked', v_clicked_count,
      'signed_up', v_signed_up_count,
      'verified', v_verified_count,
      'pending_tokens_from_referrals', v_ref_pending_tokens,
      'approved_tokens_from_referrals', v_ref_approved_tokens
    ),
    'invites_sent', v_invites_sent,
    'updates', v_updates,
    'public_stats', v_stats,
    'checklist', v_checklist,
    'next_action', CASE
      WHEN v_profile.id IS NULL THEN 'create_profile'
      WHEN v_profile.referral_code IS NULL AND v_tokens.referral_code IS NULL THEN 'get_referral_code'
      WHEN v_invites_sent = 0 AND v_referral_count = 0 THEN 'send_first_invite'
      WHEN v_profile.linked_user_id IS NULL THEN 'create_full_account'
      WHEN v_tokens.status = 'linked' THEN 'await_verification'
      WHEN v_tokens.status = 'verified' AND COALESCE(v_tokens.approved_tokens, 0) = 0 THEN 'await_token_approval'
      ELSE 'share_referral'
    END
  );
END;
$$;