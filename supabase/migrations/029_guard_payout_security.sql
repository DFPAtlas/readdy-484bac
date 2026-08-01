-- Migration 029: Guard Payout Security Hardening
-- Adds columns, constraints, indexes, and RLS for guard_payouts table
-- SAFELY REPEATABLE: all DDL uses IF NOT EXISTS / DO-block guards

BEGIN;

-- =====================================================================
-- 1. Add new columns for audit trail and idempotency
-- =====================================================================
ALTER TABLE app.guard_payouts 
  ADD COLUMN IF NOT EXISTS released_by UUID,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- =====================================================================
-- 2. Preflight: detect conflicting active payout records before creating
--    the unique partial index. This prevents silent data corruption.
-- =====================================================================
DO $$
DECLARE
  conflict_count integer;
  conflict_details text;
BEGIN
  SELECT COUNT(*), string_agg(assignment_id::text, ', ' ORDER BY assignment_id::text)
    INTO conflict_count, conflict_details
    FROM app.guard_payouts
    WHERE status NOT IN ('failed', 'manual_review')
    GROUP BY assignment_id
    HAVING COUNT(*) > 1
    LIMIT 1;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Migration 029 blocked: duplicate active guard_payouts exist for assignment_id(s) %.', conflict_details
      USING HINT = 'Manually resolve these duplicate active payouts before reapplying this migration. Do not delete financial history — move one to status=failed or manual_review.';
  END IF;
END $$;

-- =====================================================================
-- 3. Partial unique index: prevent duplicate non-failed payouts
--    Only one active payout per assignment at any time.
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_guard_payouts_assignment_active_unique 
  ON app.guard_payouts (assignment_id) 
  WHERE status NOT IN ('failed', 'manual_review');

-- =====================================================================
-- 4. Performance indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_guard_payouts_released_by ON app.guard_payouts (released_by);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_idempotency_key ON app.guard_payouts (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_stripe_transfer ON app.guard_payouts (stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guard_payouts_created_at ON app.guard_payouts (created_at DESC);

-- =====================================================================
-- 5. RLS: Remove any authenticated INSERT/UPDATE policies
--    Payout writes MUST flow through the finance-protected Edge Function
--    which uses the service-role client (service-role bypasses RLS).
-- =====================================================================

-- Drop any admin insert/update policies that may exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'Admin insert guard_payouts') THEN
    DROP POLICY "Admin insert guard_payouts" ON app.guard_payouts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'Admin update guard_payouts') THEN
    DROP POLICY "Admin update guard_payouts" ON app.guard_payouts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'Admins manage payouts') THEN
    DROP POLICY "Admins manage payouts" ON app.guard_payouts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'Allow admin insert guard_payouts') THEN
    DROP POLICY "Allow admin insert guard_payouts" ON app.guard_payouts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'Allow admin update guard_payouts') THEN
    DROP POLICY "Allow admin update guard_payouts" ON app.guard_payouts;
  END IF;
END $$;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE app.guard_payouts ENABLE ROW LEVEL SECURITY;

-- Existing SELECT policies ("Guards read own payouts", "Admins read all payouts",
-- "guard_payouts_select") are preserved — we only drop INSERT/UPDATE policies.
-- Guards can still see their own payouts; admins can still read payouts.
-- No new INSERT, UPDATE, or DELETE policies are created for authenticated users.

COMMIT;