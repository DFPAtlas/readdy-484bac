-- QG Launch Rewards Phase 5: Pre-Account Token Tracking
-- Migration: 023_qg_pre_account_token_tracking

-- Table: Holds QG Tokens against an email before full account creation
CREATE TABLE IF NOT EXISTS app.qg_pre_account_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalised text not null,
  linked_user_id uuid references auth.users(id) on delete set null,
  intended_role text default 'unknown',
  source text default 'qg_launch_rewards',
  referral_code text,
  referrer_user_id uuid references auth.users(id) on delete set null,
  pending_tokens integer default 0,
  approved_tokens integer default 0,
  cancelled_tokens integer default 0,
  status text default 'pre_account',
  linked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Constraints
ALTER TABLE app.qg_pre_account_tokens ADD CONSTRAINT chk_pre_acc_intended_role CHECK (intended_role IN ('guard','client','unknown'));
ALTER TABLE app.qg_pre_account_tokens ADD CONSTRAINT chk_pre_acc_status CHECK (status IN ('pre_account','linked','verified','cancelled','rejected'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pre_account_email_norm ON app.qg_pre_account_tokens(email_normalised);
CREATE INDEX IF NOT EXISTS idx_pre_account_linked_user ON app.qg_pre_account_tokens(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_pre_account_referrer ON app.qg_pre_account_tokens(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_pre_account_ref_code ON app.qg_pre_account_tokens(referral_code);
CREATE INDEX IF NOT EXISTS idx_pre_account_status ON app.qg_pre_account_tokens(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_account_email_unique_active ON app.qg_pre_account_tokens(email_normalised) WHERE status IN ('pre_account','linked','verified');

-- Add pre_account_token_id to token ledger
ALTER TABLE app.qg_token_ledger ADD COLUMN IF NOT EXISTS pre_account_token_id uuid references app.qg_pre_account_tokens(id) on delete set null;
CREATE INDEX IF NOT EXISTS idx_token_ledger_pre_account ON app.qg_token_ledger(pre_account_token_id);

-- Enable RLS
ALTER TABLE app.qg_pre_account_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Normal users can only read pre-account records linked to their own user ID
DROP POLICY IF EXISTS "Users read own linked pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Users read own linked pre-account tokens" ON app.qg_pre_account_tokens
  FOR SELECT
  TO authenticated
  USING (linked_user_id = auth.uid());

-- Normal users cannot insert/update/delete
DROP POLICY IF EXISTS "Users cannot insert pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Users cannot insert pre-account tokens" ON app.qg_pre_account_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users cannot update pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Users cannot update pre-account tokens" ON app.qg_pre_account_tokens
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users cannot delete pre-account tokens" ON app.qg_pre_account_tokens;
CREATE POLICY "Users cannot delete pre-account tokens" ON app.qg_pre_account_tokens
  FOR DELETE
  TO authenticated
  USING (false);

-- Admin users can manage all pre-account tokens (applied via service_role or admin check in edge functions)

-- Helper: Link pre-account tokens to a newly created user
CREATE OR REPLACE FUNCTION app.link_qg_pre_account_tokens(user_uuid uuid, user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_normalised text;
  v_pre_row record;
  v_existing_ledger record;
  v_result jsonb;
BEGIN
  v_normalised := lower(trim(user_email));
  
  SELECT * INTO v_pre_row
  FROM app.qg_pre_account_tokens
  WHERE email_normalised = v_normalised
    AND status = 'pre_account'
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'linked', false,
      'message', 'No pre-account token record found for this email'
    );
  END IF;

  IF v_pre_row.referrer_user_id = user_uuid THEN
    RETURN jsonb_build_object(
      'linked', false,
      'message', 'Self-referral blocked — you cannot link your own referral tokens'
    );
  END IF;
  
  UPDATE app.qg_pre_account_tokens
  SET linked_user_id = user_uuid,
      status = 'linked',
      linked_at = now(),
      updated_at = now()
  WHERE id = v_pre_row.id;

  SELECT * INTO v_existing_ledger
  FROM app.qg_token_ledger
  WHERE user_id = user_uuid
    AND event_type = 'pre_account_tokens_linked'
    AND pre_account_token_id = v_pre_row.id
  LIMIT 1;

  IF NOT FOUND AND v_pre_row.pending_tokens > 0 THEN
    INSERT INTO app.qg_token_ledger (
      user_id,
      event_type,
      tokens,
      status,
      pre_account_token_id,
      created_at
    ) VALUES (
      user_uuid,
      'pre_account_tokens_linked',
      v_pre_row.pending_tokens,
      'pending',
      v_pre_row.id,
      now()
    );
  END IF;

  v_result := jsonb_build_object(
    'linked', true,
    'pending_tokens', COALESCE(v_pre_row.pending_tokens, 0),
    'approved_tokens', COALESCE(v_pre_row.approved_tokens, 0),
    'credit_estimate_pence', CEIL(COALESCE(v_pre_row.pending_tokens, 0) * 10),
    'credit_estimate_pounds', ROUND((COALESCE(v_pre_row.pending_tokens, 0) * 10) / 100.0, 2),
    'status', 'linked',
    'message', 'Pre-account tokens linked successfully'
  );

  RETURN v_result;
END;
$$;

-- Helper: Get pre-account token summary for admin use
CREATE OR REPLACE FUNCTION app.get_qg_pre_account_token_summary(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_normalised text;
  v_row record;
BEGIN
  v_normalised := lower(trim(user_email));
  
  SELECT * INTO v_row
  FROM app.qg_pre_account_tokens
  WHERE email_normalised = v_normalised
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'email_normalised', v_row.email_normalised,
    'pending_tokens', COALESCE(v_row.pending_tokens, 0),
    'approved_tokens', COALESCE(v_row.approved_tokens, 0),
    'cancelled_tokens', COALESCE(v_row.cancelled_tokens, 0),
    'status', v_row.status,
    'linked_user_id', v_row.linked_user_id,
    'referral_code', v_row.referral_code,
    'referrer_user_id', v_row.referrer_user_id,
    'intended_role', v_row.intended_role,
    'created_at', v_row.created_at,
    'linked_at', v_row.linked_at,
    'verified_at', v_row.verified_at
  );
END;
$$;

-- Helper: Get dashboard-ready token data for a user
CREATE OR REPLACE FUNCTION app.get_my_qg_token_dashboard(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_approved integer;
  v_pending integer;
  v_cancelled integer;
  v_pre_row record;
  v_referral_code text;
  v_result jsonb;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'approved' THEN tokens ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'pending' THEN tokens ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'cancelled' THEN tokens ELSE 0 END), 0)
  INTO v_approved, v_pending, v_cancelled
  FROM app.qg_token_ledger
  WHERE user_id = user_uuid;

  SELECT code INTO v_referral_code
  FROM app.qg_referral_codes
  WHERE owner_user_id = user_uuid AND status = 'active'
  LIMIT 1;

  SELECT * INTO v_pre_row
  FROM app.qg_pre_account_tokens
  WHERE linked_user_id = user_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  v_result := jsonb_build_object(
    'approved_tokens', v_approved,
    'pending_tokens', v_pending,
    'cancelled_tokens', v_cancelled,
    'total_tokens', v_approved + v_pending,
    'available_tokens', v_approved,
    'estimated_credit_pence', v_approved * 10,
    'estimated_credit_pounds', ROUND((v_approved * 10) / 100.0, 2),
    'referral_code', COALESCE(v_referral_code, ''),
    'referral_link', CASE WHEN v_referral_code IS NOT NULL THEN '/qg-launch-rewards?ref=' || v_referral_code ELSE '' END
  );

  IF FOUND THEN
    v_result := v_result || jsonb_build_object(
      'pre_account_tokens_linked', true,
      'pre_account_pending_tokens', COALESCE(v_pre_row.pending_tokens, 0),
      'pre_account_status', v_pre_row.status,
      'pre_account_linked_at', v_pre_row.linked_at
    );
  ELSE
    v_result := v_result || jsonb_build_object(
      'pre_account_tokens_linked', false,
      'pre_account_pending_tokens', 0,
      'pre_account_status', null,
      'pre_account_linked_at', null
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Seed settings
INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES
  ('pre_account_token_tracking_enabled', 'true', now()),
  ('pre_account_auto_link_on_signup', 'true', now())
ON CONFLICT (key) DO NOTHING;