-- Migration 029: Guard Payout Security Hardening
-- Adds columns, constraints, indexes, and RLS for guard_payouts table

BEGIN;

-- 1. Add new columns for audit trail and idempotency
ALTER TABLE app.guard_payouts 
  ADD COLUMN IF NOT EXISTS released_by UUID,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Partial unique index: prevent duplicate non-failed payouts for the same assignment
-- Only one active (non-failed, non-manual_review) payout per assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_guard_payouts_assignment_active_unique 
  ON app.guard_payouts (assignment_id) 
  WHERE status NOT IN ('failed', 'manual_review');

-- 3. Additional indexes for query performance
CREATE INDEX IF NOT EXISTS idx_guard_payouts_released_by ON app.guard_payouts (released_by);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_idempotency_key ON app.guard_payouts (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_stripe_transfer ON app.guard_payouts (stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guard_payouts_created_at ON app.guard_payouts (created_at DESC);

-- 4. RLS: Only admins can insert or update guard_payouts
-- Drop any existing permissive insert/update policies first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guard_payouts' AND schemaname = 'app' AND policyname = 'Admins manage payouts') THEN
    DROP POLICY "Admins manage payouts" ON app.guard_payouts;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guard_payouts' AND schemaname = 'app' AND policyname = 'Allow admin insert guard_payouts') THEN
    DROP POLICY "Allow admin insert guard_payouts" ON app.guard_payouts;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guard_payouts' AND schemaname = 'app' AND policyname = 'Allow admin update guard_payouts') THEN
    DROP POLICY "Allow admin update guard_payouts" ON app.guard_payouts;
  END IF;
END $$;

-- Admin insert policy: only active admins can create payout records
CREATE POLICY "Admin insert guard_payouts" ON app.guard_payouts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admin update policy: only active admins can update payout records
CREATE POLICY "Admin update guard_payouts" ON app.guard_payouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Ensure RLS is enabled
ALTER TABLE app.guard_payouts ENABLE ROW LEVEL SECURITY;

COMMIT;