-- ============================================================
-- Migration 006: Job Posting Enhancements
-- Adds: draft status, scheduled publishing, expiry dates, featured/urgent flags
-- ============================================================

-- 1. Add new columns to app.jobs
ALTER TABLE app.jobs
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_close_on_expiry BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_publish_at ON app.jobs(publish_at) WHERE publish_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON app.jobs(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_featured ON app.jobs(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_urgent ON app.jobs(is_urgent) WHERE is_urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_draft ON app.jobs(is_draft) WHERE is_draft = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_featured_until ON app.jobs(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status_featured ON app.jobs(status, is_featured) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_jobs_status_urgent ON app.jobs(status, is_urgent) WHERE is_deleted = FALSE;

-- 3. Recreate public.jobs view to include new columns
CREATE OR REPLACE VIEW public.jobs WITH (security_invoker=true) AS
SELECT
  id, client_id, job_title, security_type, number_of_guards, start_date, end_date,
  start_time, end_time, urgency, sia_licence_required, required_licence_types,
  experience_level, venue_name, venue_address_line1, venue_address_line2, venue_city,
  venue_postcode, job_description, uniform_required, uniform_details, additional_requirements,
  hourly_rate, payment_terms, status, views, applications_count, created_at, updated_at,
  city, postcode, specific_licences, assigned_count, is_deleted, deleted_at, address_line1,
  address_line2, contact_name, contact_phone, contact_email, special_instructions, dress_code,
  number_of_days, latitude, longitude, geocoded_at,
  venue_category, required_license_type, booking_type, risk_level,
  lone_worker_flag, emergency_contact_name, emergency_contact_phone,
  out_of_hours_contact_name, out_of_hours_contact_phone,
  site_access_instructions, parking_instructions, patrol_expectations,
  cctv_details, emergency_process, repeat_pattern, repeat_frequency,
  repeat_end_date, is_recurring, parent_job_id, saved_site_id,
  terms_accepted, terms_accepted_at, booking_reference, client_confirmed,
  client_confirmed_at, confirmation_notes, disputed, disputed_at, disputed_reason,
  checked_in_count, late_count, no_show_count, issue_count, site_instructions,
  publish_at, expires_at, is_featured, is_urgent, is_draft, auto_close_on_expiry,
  featured_until, draft_saved_at
FROM app.jobs;

-- 4. Update existing data
UPDATE app.jobs SET is_draft = FALSE WHERE is_draft IS NULL;
UPDATE app.jobs SET is_urgent = TRUE WHERE urgency IN ('urgent', 'immediate') AND is_urgent IS NULL;
UPDATE app.jobs SET is_featured = FALSE WHERE is_featured IS NULL;
UPDATE app.jobs SET auto_close_on_expiry = TRUE WHERE auto_close_on_expiry IS NULL;