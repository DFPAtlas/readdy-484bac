-- ============================================================================
-- QG Launch Rewards — Phase 3: Invite Email System & Campaign Tools
-- Migration: 020_qg_launch_rewards_invites_phase_3
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.qg_launch_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text CHECK (sender_role IN ('guard','client','admin','system')),
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_role text CHECK (recipient_role IN ('guard','client','unknown')) DEFAULT 'unknown',
  referral_code_id uuid REFERENCES app.qg_referral_codes(id) ON DELETE SET NULL,
  referral_code text,
  invite_url text,
  campaign_id uuid,
  status text DEFAULT 'queued' CHECK (status IN ('queued','sent','opened','clicked','signed_up','verified','bounced','complained','cancelled','failed')),
  email_provider_message_id text,
  failure_reason text,
  opened_at timestamptz,
  clicked_at timestamptz,
  signed_up_at timestamptz,
  verified_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.qg_launch_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  target_role text CHECK (target_role IN ('guard','client','mixed')) DEFAULT 'mixed',
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  email_subject text NOT NULL,
  email_preview text,
  email_body_html text,
  email_body_text text,
  default_referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  send_limit integer DEFAULT 500,
  sent_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  signup_count integer DEFAULT 0,
  verified_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.qg_invite_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  invite_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS app.email_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  reason text CHECK (reason IN ('unsubscribed','bounced','complained','manual_block','invalid')),
  source text DEFAULT 'qg_launch_rewards',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qg_launch_invites_sender ON app.qg_launch_invites(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_qg_launch_invites_recipient ON app.qg_launch_invites(recipient_email);
CREATE INDEX IF NOT EXISTS idx_qg_launch_invites_ref_code ON app.qg_launch_invites(referral_code);
CREATE INDEX IF NOT EXISTS idx_qg_launch_invites_status ON app.qg_launch_invites(status);
CREATE INDEX IF NOT EXISTS idx_qg_launch_invites_campaign ON app.qg_launch_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qg_launch_campaigns_status ON app.qg_launch_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_qg_invite_rate_limits_lookup ON app.qg_invite_rate_limits(user_id, date);

-- Seed Phase 3 settings
INSERT INTO app.qg_launch_reward_settings (key, value) VALUES
  ('invite_system_enabled', 'true'),
  ('max_user_invites_per_day', '25'),
  ('max_admin_campaign_sends_per_day', '1000'),
  ('invite_cooldown_minutes', '2'),
  ('block_disposable_email_domains', 'true'),
  ('require_marketing_consent_for_bulk_campaigns', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE app.qg_launch_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_invite_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_suppression_list ENABLE ROW LEVEL SECURITY;

-- QG Launch Invites
DROP POLICY IF EXISTS "Users can view own invites" ON app.qg_launch_invites;
CREATE POLICY "Users can view own invites" ON app.qg_launch_invites
  FOR SELECT USING (sender_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages invites" ON app.qg_launch_invites;
CREATE POLICY "Service role manages invites" ON app.qg_launch_invites
  FOR ALL USING (true) WITH CHECK (true);

-- QG Launch Campaigns
DROP POLICY IF EXISTS "Service role manages campaigns" ON app.qg_launch_campaigns;
CREATE POLICY "Service role manages campaigns" ON app.qg_launch_campaigns
  FOR ALL USING (true) WITH CHECK (true);

-- QG Invite Rate Limits
DROP POLICY IF EXISTS "Users can view own rate limits" ON app.qg_invite_rate_limits;
CREATE POLICY "Users can view own rate limits" ON app.qg_invite_rate_limits
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages rate limits" ON app.qg_invite_rate_limits;
CREATE POLICY "Service role manages rate limits" ON app.qg_invite_rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- Email Suppression List
DROP POLICY IF EXISTS "Service role manages suppression" ON app.email_suppression_list;
CREATE POLICY "Service role manages suppression" ON app.email_suppression_list
  FOR ALL USING (true) WITH CHECK (true);