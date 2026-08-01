-- Migration 016: Job Booking Flow Fixes
-- Adds guard_payouts admin RLS, guard_booking_confirmation template already inserted
-- Most RLS already existed from previous migrations

-- Add admin insert/update policies for guard_payouts (SELECT already exists)
-- These are idempotent - skip if already present

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'guard_payouts_admin_insert') THEN
    CREATE POLICY "guard_payouts_admin_insert" ON app.guard_payouts FOR INSERT TO authenticated WITH CHECK (is_active_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'guard_payouts_admin_update') THEN
    CREATE POLICY "guard_payouts_admin_update" ON app.guard_payouts FOR UPDATE TO authenticated USING (is_active_admin()) WITH CHECK (is_active_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'guard_payouts' AND policyname = 'guard_payouts_service_role_all') THEN
    CREATE POLICY "guard_payouts_service_role_all" ON app.guard_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;