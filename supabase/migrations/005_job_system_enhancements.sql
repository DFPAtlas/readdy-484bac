-- ============================================================
-- Migration 005: Job System Enhancements
-- QuickGuard.uk — saved_jobs, job_invites, apply-once constraint,
-- updated_at triggers, index optimisation, RLS cleanup
-- ============================================================

-- -----------------------------------------------------------------
-- 1. SAVED_JOBS TABLE — Guards can bookmark jobs for later
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES app.guards(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES app.jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(guard_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_guard ON app.saved_jobs(guard_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job ON app.saved_jobs(job_id);

-- -----------------------------------------------------------------
-- 2. JOB_INVITES TABLE — Clients can invite specific guards to apply
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.job_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES app.jobs(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES app.guards(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES app.clients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  message TEXT,
  UNIQUE(job_id, guard_id)
);

CREATE INDEX IF NOT EXISTS idx_job_invites_job ON app.job_invites(job_id);
CREATE INDEX IF NOT EXISTS idx_job_invites_guard ON app.job_invites(guard_id);
CREATE INDEX IF NOT EXISTS idx_job_invites_client ON app.job_invites(client_id);

-- -----------------------------------------------------------------
-- 3. APPLY-ONCE CONSTRAINT — Prevent duplicate applications
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app.job_applications'::regclass
      AND contype = 'u'
      AND conname = 'job_applications_job_guard_unique'
  ) THEN
    ALTER TABLE app.job_applications
      ADD CONSTRAINT job_applications_job_guard_unique
      UNIQUE (job_id, guard_id);
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 4. INDEX OPTIMISATION for jobs and job_applications
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_jobs_client_status ON app.jobs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON app.jobs(venue_city);
CREATE INDEX IF NOT EXISTS idx_jobs_postcode ON app.jobs(venue_postcode);
CREATE INDEX IF NOT EXISTS idx_jobs_status_deleted ON app.jobs(status, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON app.jobs(start_date);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON app.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_hourly_rate ON app.jobs(hourly_rate);
CREATE INDEX IF NOT EXISTS idx_jobs_urgency ON app.jobs(urgency);
CREATE INDEX IF NOT EXISTS idx_jobs_booking_ref ON app.jobs(booking_reference);
CREATE INDEX IF NOT EXISTS idx_jobs_latitude ON app.jobs(latitude);
CREATE INDEX IF NOT EXISTS idx_jobs_longitude ON app.jobs(longitude);
CREATE INDEX IF NOT EXISTS idx_jobs_lat_lon ON app.jobs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_security_type ON app.jobs(security_type);
CREATE INDEX IF NOT EXISTS idx_jobs_sia_required ON app.jobs(sia_licence_required);
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job ON app.jobs(parent_job_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_job ON app.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_guard ON app.job_applications(guard_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON app.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_status ON app.job_applications(job_id, status);

-- -----------------------------------------------------------------
-- 5. AUTO-UPDATE updated_at TRIGGER for jobs and job_applications
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'app.jobs'::regclass
      AND tgname = 'trg_app_jobs_updated_at'
  ) THEN
    CREATE TRIGGER trg_app_jobs_updated_at
      BEFORE UPDATE ON app.jobs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'app.job_applications'::regclass
      AND tgname = 'trg_app_job_applications_updated_at'
  ) THEN
    CREATE TRIGGER trg_app_job_applications_updated_at
      BEFORE UPDATE ON app.job_applications
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'app.saved_jobs'::regclass
      AND tgname = 'trg_app_saved_jobs_updated_at'
  ) THEN
    CREATE TRIGGER trg_app_saved_jobs_updated_at
      BEFORE UPDATE ON app.saved_jobs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'app.job_invites'::regclass
      AND tgname = 'trg_app_job_invites_updated_at'
  ) THEN
    CREATE TRIGGER trg_app_job_invites_updated_at
      BEFORE UPDATE ON app.job_invites
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 6. RLS CLEANUP — Remove conflicting / redundant policies
-- -----------------------------------------------------------------
-- The existing policy "jobs_client_own_rows" is redundant because:
--   - jobs_owner_insert/UPDATE/DELETE already handle authenticated clients
--   - jobs_select already handles authenticated clients viewing own jobs
--   - jobs_guards_view_open covers the public SELECT for open jobs
DROP POLICY IF EXISTS jobs_client_own_rows ON app.jobs;

-- The existing "jobs_guards_view_open" is redundant because:
--   - jobs_select already covers open/in_progress/active for all users
--   - It only allows 'open' which is a subset of the jobs_select policy
-- However, keeping it is safer because it explicitly restricts public SELECT
-- to just 'open' jobs. We'll refine jobs_select instead.
-- Drop the overly broad jobs_select and recreate it properly.
DROP POLICY IF EXISTS jobs_select ON app.jobs;

-- -----------------------------------------------------------------
-- 7. RLS: JOBS TABLE
--    - Clients: create, manage, delete only their own jobs
--    - Guards: view open/active jobs only
--    - Public: view open/active jobs only
--    - Admins: view all jobs
--    - Service role: full access
-- -----------------------------------------------------------------
-- Ensure RLS is enabled
ALTER TABLE app.jobs ENABLE ROW LEVEL SECURITY;

-- Guards and public can view open / in_progress / active / confirmed jobs
DROP POLICY IF EXISTS jobs_guards_view_open ON app.jobs;
CREATE POLICY jobs_guards_view_open ON app.jobs
  FOR SELECT
  TO public
  USING (
    status IN ('open', 'in_progress', 'active', 'confirmed')
    AND COALESCE(is_deleted, false) = false
  );

-- Clients can view their own jobs regardless of status
DROP POLICY IF EXISTS jobs_client_view_own ON app.jobs;
CREATE POLICY jobs_client_view_own ON app.jobs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

-- Clients can create jobs (must set their own client_id)
DROP POLICY IF EXISTS jobs_client_insert ON app.jobs;
CREATE POLICY jobs_client_insert ON app.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

-- Clients can update their own jobs
DROP POLICY IF EXISTS jobs_client_update ON app.jobs;
CREATE POLICY jobs_client_update ON app.jobs
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

-- Clients can delete (soft-delete) their own jobs
DROP POLICY IF EXISTS jobs_client_delete ON app.jobs;
CREATE POLICY jobs_client_delete ON app.jobs
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

-- Admins can view all jobs
DROP POLICY IF EXISTS jobs_admin_select ON app.jobs;
CREATE POLICY jobs_admin_select ON app.jobs
  FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Service role full access
DROP POLICY IF EXISTS jobs_service_role_all ON app.jobs;
CREATE POLICY jobs_service_role_all ON app.jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- 8. RLS: JOB_APPLICATIONS TABLE
--    - Guards: view own applications, apply once (constraint enforced)
--    - Clients: view applications for their jobs, update status
--    - Admins: view all applications
--    - Service role: full access
-- -----------------------------------------------------------------
ALTER TABLE app.job_applications ENABLE ROW LEVEL SECURITY;

-- Guards can view their own applications
DROP POLICY IF EXISTS job_apps_guard_select ON app.job_applications;
CREATE POLICY job_apps_guard_select ON app.job_applications
  FOR SELECT
  TO public
  USING (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

-- Guards can insert their own applications (apply once enforced by unique constraint)
DROP POLICY IF EXISTS job_apps_guard_insert ON app.job_applications;
CREATE POLICY job_apps_guard_insert ON app.job_applications
  FOR INSERT
  TO public
  WITH CHECK (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

-- Guards can delete their own pending applications
DROP POLICY IF EXISTS job_apps_guard_delete ON app.job_applications;
CREATE POLICY job_apps_guard_delete ON app.job_applications
  FOR DELETE
  TO public
  USING (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- Clients can view applications for their jobs
DROP POLICY IF EXISTS job_apps_client_select ON app.job_applications;
CREATE POLICY job_apps_client_select ON app.job_applications
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM app.jobs j
      JOIN app.clients c ON j.client_id = c.id
      WHERE j.id = job_applications.job_id
        AND c.user_id = auth.uid()
    )
  );

-- Clients can update applications for their jobs (e.g. change status)
DROP POLICY IF EXISTS job_apps_client_update ON app.job_applications;
CREATE POLICY job_apps_client_update ON app.job_applications
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM app.jobs j
      JOIN app.clients c ON j.client_id = c.id
      WHERE j.id = job_applications.job_id
        AND c.user_id = auth.uid()
    )
  );

-- Admins can view all applications
DROP POLICY IF EXISTS job_apps_admin_select ON app.job_applications;
CREATE POLICY job_apps_admin_select ON app.job_applications
  FOR SELECT
  TO authenticated
  USING (is_active_admin());

-- Service role full access
DROP POLICY IF EXISTS job_apps_service_role_all ON app.job_applications;
CREATE POLICY job_apps_service_role_all ON app.job_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- 9. RLS: SAVED_JOBS TABLE
--    - Guards: view, insert, delete their own saved jobs
--    - Admins: view all
--    - Service role: full access
-- -----------------------------------------------------------------
ALTER TABLE app.saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_jobs_guard_select ON app.saved_jobs;
CREATE POLICY saved_jobs_guard_select ON app.saved_jobs
  FOR SELECT
  TO public
  USING (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS saved_jobs_guard_insert ON app.saved_jobs;
CREATE POLICY saved_jobs_guard_insert ON app.saved_jobs
  FOR INSERT
  TO public
  WITH CHECK (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS saved_jobs_guard_delete ON app.saved_jobs;
CREATE POLICY saved_jobs_guard_delete ON app.saved_jobs
  FOR DELETE
  TO public
  USING (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS saved_jobs_admin_select ON app.saved_jobs;
CREATE POLICY saved_jobs_admin_select ON app.saved_jobs
  FOR SELECT
  TO authenticated
  USING (is_active_admin());

DROP POLICY IF EXISTS saved_jobs_service_role_all ON app.saved_jobs;
CREATE POLICY saved_jobs_service_role_all ON app.saved_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- 10. RLS: JOB_INVITES TABLE
--    - Clients: view, create, update invites for their jobs
--    - Guards: view invites sent to them
--    - Admins: view all
--    - Service role: full access
-- -----------------------------------------------------------------
ALTER TABLE app.job_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_invites_client_select ON app.job_invites;
CREATE POLICY job_invites_client_select ON app.job_invites
  FOR SELECT
  TO public
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_invites_client_insert ON app.job_invites;
CREATE POLICY job_invites_client_insert ON app.job_invites
  FOR INSERT
  TO public
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_invites_client_update ON app.job_invites;
CREATE POLICY job_invites_client_update ON app.job_invites
  FOR UPDATE
  TO public
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_invites_client_delete ON app.job_invites;
CREATE POLICY job_invites_client_delete ON app.job_invites
  FOR DELETE
  TO public
  USING (
    client_id IN (
      SELECT c.id FROM app.clients c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_invites_guard_select ON app.job_invites;
CREATE POLICY job_invites_guard_select ON app.job_invites
  FOR SELECT
  TO public
  USING (
    guard_id IN (
      SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_invites_admin_select ON app.job_invites;
CREATE POLICY job_invites_admin_select ON app.job_invites
  FOR SELECT
  TO authenticated
  USING (is_active_admin());

DROP POLICY IF EXISTS job_invites_service_role_all ON app.job_invites;
CREATE POLICY job_invites_service_role_all ON app.job_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- 11. RECREATE PUBLIC VIEWS for new tables
-- -----------------------------------------------------------------
DROP VIEW IF EXISTS public.saved_jobs;
CREATE VIEW public.saved_jobs WITH (security_invoker=true) AS
SELECT id, guard_id, job_id, saved_at, notes
FROM app.saved_jobs;

DROP VIEW IF EXISTS public.job_invites;
CREATE VIEW public.job_invites WITH (security_invoker=true) AS
SELECT id, job_id, guard_id, client_id, status, invited_at, responded_at, message
FROM app.job_invites;

-- -----------------------------------------------------------------
-- 12. VIEWS for existing tables with missing columns
-- -----------------------------------------------------------------
DROP VIEW IF EXISTS public.jobs;
CREATE VIEW public.jobs WITH (security_invoker=true) AS
SELECT
  id, client_id, job_title, security_type, number_of_guards, number_of_days,
  start_date, end_date, start_time, end_time, urgency,
  sia_licence_required, required_licence_types, experience_level,
  venue_name, venue_address_line1, venue_address_line2, venue_city, venue_postcode,
  job_description, uniform_required, uniform_details, additional_requirements,
  hourly_rate, payment_terms, status, views, applications_count, assigned_count,
  created_at, updated_at, city, postcode, specific_licences, is_deleted, deleted_at,
  address_line1, address_line2, contact_name, contact_phone, contact_email,
  special_instructions, dress_code, latitude, longitude, geocoded_at,
  venue_category, required_license_type, booking_type, risk_level,
  lone_worker_flag, emergency_contact_name, emergency_contact_phone,
  out_of_hours_contact_name, out_of_hours_contact_phone,
  site_access_instructions, parking_instructions, patrol_expectations,
  cctv_details, emergency_process, repeat_pattern, repeat_frequency,
  repeat_end_date, is_recurring, parent_job_id, saved_site_id,
  terms_accepted, terms_accepted_at, booking_reference, client_confirmed,
  client_confirmed_at, confirmation_notes, disputed, disputed_at, disputed_reason,
  checked_in_count, late_count, no_show_count, issue_count, site_instructions
FROM app.jobs;

DROP VIEW IF EXISTS public.job_applications;
CREATE VIEW public.job_applications WITH (security_invoker=true) AS
SELECT
  id, job_id, guard_id, status, cover_message, applied_at, reviewed_at,
  cover_letter, updated_at, created_at, shortlisted
FROM app.job_applications;