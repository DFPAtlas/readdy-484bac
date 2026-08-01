-- Phase 4: Fraud Scoring, Analytics, Audit Log
-- QG Launch Rewards

-- Tables
CREATE TABLE IF NOT EXISTS app.qg_fraud_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references app.qg_referrals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text default 'medium' check (severity in ('low','medium','high','critical')),
  score integer default 0,
  reason text,
  metadata jsonb,
  review_status text default 'open' check (review_status in ('open','reviewing','cleared','confirmed','ignored')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS app.qg_launch_reward_daily_stats (
  id uuid primary key default gen_random_uuid(),
  stat_date date not null unique,
  new_referral_clicks integer default 0,
  new_guard_signups integer default 0,
  new_client_signups integer default 0,
  new_verified_guards integer default 0,
  new_verified_clients integer default 0,
  tokens_pending integer default 0,
  tokens_approved integer default 0,
  tokens_redeemed integer default 0,
  credit_liability_pence integer default 0,
  credit_redeemed_pence integer default 0,
  invites_sent integer default 0,
  invite_clicks integer default 0,
  campaign_signups integer default 0,
  fraud_events integer default 0,
  high_risk_referrals integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS app.qg_launch_reward_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  target_type text,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz default now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qg_fraud_events_referral ON app.qg_fraud_events(referral_id);
CREATE INDEX IF NOT EXISTS idx_qg_fraud_events_user ON app.qg_fraud_events(user_id);
CREATE INDEX IF NOT EXISTS idx_qg_fraud_events_severity ON app.qg_fraud_events(severity);
CREATE INDEX IF NOT EXISTS idx_qg_fraud_events_review_status ON app.qg_fraud_events(review_status);
CREATE INDEX IF NOT EXISTS idx_qg_fraud_events_created ON app.qg_fraud_events(created_at);
CREATE INDEX IF NOT EXISTS idx_qg_daily_stats_date ON app.qg_launch_reward_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_qg_audit_log_actor ON app.qg_launch_reward_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_qg_audit_log_action ON app.qg_launch_reward_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_qg_audit_log_target ON app.qg_launch_reward_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_qg_audit_log_created ON app.qg_launch_reward_audit_log(created_at);

-- RLS Policies
ALTER TABLE app.qg_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qg_launch_reward_audit_log ENABLE ROW LEVEL SECURITY;

-- qg_fraud_events: users cannot read
CREATE POLICY "Fraud events - admin select" ON app.qg_fraud_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM app.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Fraud events - service role" ON app.qg_fraud_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- qg_launch_reward_daily_stats: users cannot read
CREATE POLICY "Daily stats - admin select" ON app.qg_launch_reward_daily_stats FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM app.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Daily stats - service role" ON app.qg_launch_reward_daily_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- qg_launch_reward_audit_log: users cannot read
CREATE POLICY "Audit log - admin select" ON app.qg_launch_reward_audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM app.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Audit log - service role" ON app.qg_launch_reward_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed settings
INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES
  ('fraud_scoring_enabled', 'true', now()),
  ('auto_pause_high_risk_referrals', 'true', now()),
  ('high_risk_score_threshold', '70', now()),
  ('critical_risk_score_threshold', '90', now()),
  ('max_referrals_per_user_per_day', '20', now()),
  ('max_referrals_per_user_per_week', '75', now()),
  ('max_pending_tokens_before_review', '5000', now()),
  ('analytics_enabled', 'true', now()),
  ('launch_dashboard_enabled', 'true', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Helper function: calculate risk score
CREATE OR REPLACE FUNCTION app.calculate_qg_referral_risk_score(referral_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'app'
AS $$
DECLARE
  ref_record record;
  risk_score integer := 0;
  fraud_flags text[] := '';
  risk_level text;
  recommended_action text;
  same_ip_count integer;
  same_ua_count integer;
  daily_referral_count integer;
  total_pending integer;
BEGIN
  SELECT * INTO ref_record FROM app.qg_referrals WHERE id = referral_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Referral not found');
  END IF;

  IF ref_record.referrer_user_id = ref_record.referred_user_id THEN
    risk_score := risk_score + 100;
    fraud_flags := array_append(fraud_flags, 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM app.qg_referrals WHERE referred_email = ref_record.referred_email AND id != referral_uuid AND status != 'rejected') THEN
    risk_score := risk_score + 50;
    fraud_flags := array_append(fraud_flags, 'duplicate_email');
  END IF;

  IF ref_record.referred_email IS NOT NULL AND (
    ref_record.referred_email ILIKE '%@mailinator.com' OR ref_record.referred_email ILIKE '%@guerrillamail.com'
    OR ref_record.referred_email ILIKE '%@tempmail.com' OR ref_record.referred_email ILIKE '%@10minutemail.com'
    OR ref_record.referred_email ILIKE '%@yopmail.com' OR ref_record.referred_email ILIKE '%@throwaway.email'
    OR ref_record.referred_email ILIKE '%@sharklasers.com' OR ref_record.referred_email ILIKE '%@trashmail.com'
    OR ref_record.referred_email ILIKE '%@temp-mail.org'
  ) THEN
    risk_score := risk_score + 40;
    fraud_flags := array_append(fraud_flags, 'disposable_email');
  END IF;

  SELECT count(*) INTO daily_referral_count FROM app.qg_referrals
  WHERE referrer_user_id = ref_record.referrer_user_id AND created_at > now() - interval '24 hours';
  IF daily_referral_count > 10 THEN
    risk_score := risk_score + 35;
    fraud_flags := array_append(fraud_flags, 'high_daily_referral_volume');
  END IF;

  SELECT coalesce(sum(pending_tokens), 0) INTO total_pending FROM app.qg_referrals
  WHERE referrer_user_id = ref_record.referrer_user_id AND status = 'verified';
  IF total_pending > 5000 THEN
    risk_score := risk_score + 30;
    fraud_flags := array_append(fraud_flags, 'high_pending_tokens');
  END IF;

  IF ref_record.ip_hash IS NOT NULL THEN
    SELECT count(*) INTO same_ip_count FROM app.qg_referrals
    WHERE ip_hash = ref_record.ip_hash AND referrer_user_id != ref_record.referrer_user_id;
    IF same_ip_count > 3 THEN
      risk_score := risk_score + 30;
      fraud_flags := array_append(fraud_flags, 'shared_ip_hash');
    END IF;
  END IF;

  IF ref_record.user_agent_hash IS NOT NULL THEN
    SELECT count(*) INTO same_ua_count FROM app.qg_referrals
    WHERE user_agent_hash = ref_record.user_agent_hash AND referrer_user_id != ref_record.referrer_user_id;
    IF same_ua_count > 3 THEN
      risk_score := risk_score + 20;
      fraud_flags := array_append(fraud_flags, 'shared_user_agent');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM app.qg_referral_codes WHERE id = ref_record.referral_code_id AND status IN ('paused', 'disabled')) THEN
    risk_score := risk_score + 50;
    fraud_flags := array_append(fraud_flags, 'disabled_referral_code');
  END IF;

  IF ref_record.referred_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ref_record.referred_user_id) THEN
    risk_score := risk_score + 60;
    fraud_flags := array_append(fraud_flags, 'referred_user_deleted');
  END IF;

  IF ref_record.created_at < now() - interval '30 days' AND ref_record.status NOT IN ('verified', 'approved', 'rejected') THEN
    risk_score := risk_score + 15;
    fraud_flags := array_append(fraud_flags, 'unverified_after_30d');
  END IF;

  IF ref_record.fraud_flags IS NOT NULL AND jsonb_array_length(ref_record.fraud_flags) > 0 THEN
    risk_score := risk_score + 70;
    fraud_flags := array_append(fraud_flags, 'admin_flagged');
  END IF;

  IF risk_score >= 90 THEN
    risk_level := 'critical';
    recommended_action := 'reject_or_clawback';
  ELSIF risk_score >= 70 THEN
    risk_level := 'high';
    recommended_action := 'pause_and_review';
  ELSIF risk_score >= 30 THEN
    risk_level := 'medium';
    recommended_action := 'manual_review';
  ELSE
    risk_level := 'low';
    recommended_action := 'allow';
  END IF;

  RETURN jsonb_build_object(
    'referral_id', referral_uuid,
    'risk_score', risk_score,
    'risk_level', risk_level,
    'fraud_flags', fraud_flags,
    'recommended_action', recommended_action
  );
END;
$$;

-- Helper function: refresh daily stats
CREATE OR REPLACE FUNCTION app.refresh_qg_launch_reward_daily_stats(target_date date default current_date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'app'
AS $$
DECLARE
  v_clicks integer; v_guard_signups integer; v_client_signups integer;
  v_verified_guards integer; v_verified_clients integer;
  v_tokens_pending integer; v_tokens_approved integer; v_tokens_redeemed integer;
  v_liability integer; v_redeemed_pence integer;
  v_invites_sent integer; v_invite_clicks integer; v_campaign_signups integer;
  v_fraud_events integer; v_high_risk integer;
BEGIN
  SELECT count(*) INTO v_clicks FROM app.qg_referrals WHERE date(created_at) = target_date AND status IN ('clicked', 'profile_started', 'account_created', 'verified', 'approved');
  SELECT count(*) INTO v_guard_signups FROM app.qg_referrals WHERE date(created_at) = target_date AND referred_role = 'guard' AND status != 'clicked';
  SELECT count(*) INTO v_client_signups FROM app.qg_referrals WHERE date(created_at) = target_date AND referred_role = 'client' AND status != 'clicked';
  SELECT count(*) INTO v_verified_guards FROM app.qg_referrals WHERE date(updated_at) = target_date AND referred_role = 'guard' AND status IN ('verified', 'approved');
  SELECT count(*) INTO v_verified_clients FROM app.qg_referrals WHERE date(updated_at) = target_date AND referred_role = 'client' AND status IN ('verified', 'approved');
  SELECT coalesce(sum(pending_tokens), 0) INTO v_tokens_pending FROM app.qg_referrals WHERE status = 'verified';
  SELECT coalesce(sum(approved_tokens), 0) INTO v_tokens_approved FROM app.qg_referrals WHERE date(approved_at) = target_date;
  SELECT coalesce(sum(tokens_used), 0) INTO v_tokens_redeemed FROM app.qg_token_redemptions WHERE date(created_at) = target_date AND status = 'confirmed';
  SELECT coalesce(sum(approved_tokens), 0) * 1000 / 100 INTO v_liability FROM app.qg_referrals WHERE status = 'approved';
  SELECT coalesce(sum(credit_pence), 0) INTO v_redeemed_pence FROM app.qg_token_redemptions WHERE date(created_at) = target_date AND status = 'confirmed';
  SELECT count(*) INTO v_invites_sent FROM app.qg_launch_invites WHERE date(created_at) = target_date;
  SELECT count(*) INTO v_invite_clicks FROM app.qg_launch_invites WHERE date(clicked_at) = target_date;
  SELECT count(*) INTO v_campaign_signups FROM app.qg_launch_invites WHERE date(signed_up_at) = target_date;
  SELECT count(*) INTO v_fraud_events FROM app.qg_fraud_events WHERE date(created_at) = target_date;
  SELECT count(*) INTO v_high_risk FROM app.qg_fraud_events WHERE severity IN ('high', 'critical') AND review_status = 'open';

  INSERT INTO app.qg_launch_reward_daily_stats (
    stat_date, new_referral_clicks, new_guard_signups, new_client_signups, new_verified_guards, new_verified_clients,
    tokens_pending, tokens_approved, tokens_redeemed, credit_liability_pence, credit_redeemed_pence,
    invites_sent, invite_clicks, campaign_signups, fraud_events, high_risk_referrals, updated_at
  ) VALUES (
    target_date, v_clicks, v_guard_signups, v_client_signups, v_verified_guards, v_verified_clients,
    v_tokens_pending, v_tokens_approved, v_tokens_redeemed, v_liability, v_redeemed_pence,
    v_invites_sent, v_invite_clicks, v_campaign_signups, v_fraud_events, v_high_risk, now()
  )
  ON CONFLICT (stat_date) DO UPDATE SET
    new_referral_clicks = EXCLUDED.new_referral_clicks, new_guard_signups = EXCLUDED.new_guard_signups,
    new_client_signups = EXCLUDED.new_client_signups, new_verified_guards = EXCLUDED.new_verified_guards,
    new_verified_clients = EXCLUDED.new_verified_clients, tokens_pending = EXCLUDED.tokens_pending,
    tokens_approved = EXCLUDED.tokens_approved, tokens_redeemed = EXCLUDED.tokens_redeemed,
    credit_liability_pence = EXCLUDED.credit_liability_pence, credit_redeemed_pence = EXCLUDED.credit_redeemed_pence,
    invites_sent = EXCLUDED.invites_sent, invite_clicks = EXCLUDED.invite_clicks,
    campaign_signups = EXCLUDED.campaign_signups, fraud_events = EXCLUDED.fraud_events,
    high_risk_referrals = EXCLUDED.high_risk_referrals, updated_at = now();
END;
$$;