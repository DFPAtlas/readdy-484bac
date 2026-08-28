-- EMAIL SEND LOG — REMOVE REDUNDANT USER SELECT POLICY
--
-- Narrowly scoped RLS cleanup on app.email_send_log.
--
-- Confirmed live state (read-only audit):
--   • "Admins can read email send logs"  -> app.is_active_admin()  [KEEP]
--   • "Users can read email send logs"   -> app.is_active_admin()  [REMOVE — duplicate
--     admin policy with a misleading user-facing name; no guard/client/customer UI,
--     hook, or Edge Function reads this table for a user-facing email-history feature]
--
-- No helper, no other policy, no column, no row, and no email writer is modified.
-- No related_user_id backfill. No replacement user policy.

-- Run manually in the Supabase SQL Editor — the deployment executor here blocks DROP.
DROP POLICY IF EXISTS "Users can read email send logs" ON app.email_send_log;

-- =====================================================================
-- POST-CHANGE VERIFICATION (run after the DROP above)
-- =====================================================================

-- Expected: exactly one SELECT policy remains on app.email_send_log.
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'app' AND tablename = 'email_send_log'
ORDER BY policyname;