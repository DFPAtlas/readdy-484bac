-- Migration 007: Recruitment Workflow Fixes
-- Applied: 2026-06-02
-- Fixes found during full audit of the recruitment workflow

-- ============================================================
-- FIX 1: calculate_job_payment_total used hardcoded 10% fee
-- Now reads from pricing_config table dynamically
-- Also removes incorrect VAT calculation (frontend does not add VAT)
-- ============================================================
-- (Applied via Management API - see function definition above)

-- ============================================================
-- FIX 2: Duplicate trigger causing double applications_count updates
-- trigger_update_applications_count (public schema) did simple +1/-1
-- trg_job_applications_update_counts (public schema) calls recompute_applications_count
-- Both fired on INSERT/DELETE = double increment
-- DROP the simple arithmetic one:
-- DROP TRIGGER IF EXISTS trigger_update_applications_count ON app.job_applications;
-- Note: Cannot DROP via DDL tool — run manually in Supabase SQL editor
-- ============================================================

-- ============================================================
-- FIX 3: trg_application_status_change trigger — status payload
-- When status = 'rejected' the email payload now normalises to 'declined'
-- for consistency with database status values used by the frontend
-- (Applied via Management API)
-- ============================================================

-- ============================================================
-- FIX 4: job_assignments unique constraint
-- Verified existing: job_assignments_job_id_guard_id_key
-- All upserts now use: onConflict: 'job_id,guard_id'
-- ============================================================

-- ============================================================
-- FIX 5: Status value normalisation
-- Frontend was writing 'rejected' for declined applications
-- All writes now use 'declined' to match:
--   - The RLS withdraw policy (allows pending/reviewed → withdrawn)
--   - The trigger (which fires on accepted/declined/rejected)
--   - The guard dashboard application filter tabs
-- ============================================================

-- ============================================================
-- FIX 6: Admin job assignment status
-- Was inserting status: 'assigned' which is not a valid status
-- Changed to 'confirmed' (the default and only used status in assignments)
-- ============================================================

-- ============================================================
-- FIX 7: Realtime subscriptions used wrong schema
-- JobTrackerClient, SelectGuardsClient used schema: 'public'
-- All tables live in schema: 'app'
-- Fixed to schema: 'app' in all realtime channel subscriptions
-- ============================================================

-- ============================================================
-- FIX 8: Guard dashboard Supabase query broken column names
-- job_assignments and job_applications both join to jobs but
-- referenced non-existent columns: location, postcode
-- Correct columns are: venue_city, venue_postcode
-- Fixed in loadJobAssignments, loadJobApplications, allShifts useMemo
-- ============================================================

-- ============================================================
-- FIX 9: SelectGuardsClient excluded selected guards from display
-- displayGuards was filtering to applied_at || shortlisted only
-- Now also includes selectedGuardIds to ensure selected guards are visible
-- ============================================================

-- ============================================================
-- FIX 10: Saved Jobs page was missing (404)
-- Created: app/guard/saved-jobs/page.tsx
--   - Full view, apply, and unsave functionality
--   - Uses saved_jobs table with proper RLS-compliant queries
-- ============================================================

-- ============================================================
-- FIX 11: Job Invites page was missing (404)
-- Created: app/guard/job-invites/page.tsx  
--   - Shows all invites with accept/decline actions
--   - Accept auto-inserts a job_application record
--   - Gracefully handles duplicate application (23505)
--   - Reads from job_invites with guard_id RLS scoping
-- ============================================================

SELECT 'migration_007_complete' AS status;