-- ============================================================
-- Migration 004: Guard Document Uploads
-- QuickGuard.uk — Add driving licence and proof of address columns
-- ============================================================

-- 1. Add document columns to app.guards
ALTER TABLE app.guards
  ADD COLUMN IF NOT EXISTS driving_licence_front_url text,
  ADD COLUMN IF NOT EXISTS driving_licence_back_url text,
  ADD COLUMN IF NOT EXISTS driving_licence_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_of_address_url text,
  ADD COLUMN IF NOT EXISTS proof_of_address_uploaded_at timestamptz;

-- 2. Recreate public.guards view with new columns
DROP VIEW IF EXISTS public.guards;
CREATE VIEW public.guards WITH (security_invoker=true) AS
SELECT
  id, user_id, full_name, email, phone, date_of_birth,
  profile_image_url, bio, sia_licence_number, sia_expiry_date,
  sia_verified, years_experience, hourly_rate, availability,
  location, postcode, willing_to_travel, has_transport,
  rating, total_reviews, total_jobs_completed, total_earnings,
  profile_views, is_active, verification_status, verified_at,
  verified_by, stripe_account_id, bank_account_verified,
  profile_completed, created_at, updated_at, sia_verified_at,
  licence_types, certifications, available_days,
  available_hours_from, available_hours_to, availability_status,
  max_distance_miles, min_hourly_rate, rejected_at, rejection_reason,
  license_cardholder_name, home_latitude, home_longitude,
  default_search_radius_km, onboarding_status, subscription_plan,
  subscription_status, stripe_customer_id, stripe_subscription_id,
  sia_licence_front_url, sia_licence_back_url, sia_licence_uploaded_at,
  driving_licence_front_url, driving_licence_back_url, driving_licence_uploaded_at,
  proof_of_address_url, proof_of_address_uploaded_at,
  stripe_session_id, trial_start_date, trial_end_date,
  current_period_start, current_period_end,
  plan_slug, plan_name
FROM app.guards;

-- 3. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_app_guards_driving_licence ON app.guards(driving_licence_front_url);
CREATE INDEX IF NOT EXISTS idx_app_guards_proof_of_address ON app.guards(proof_of_address_url);