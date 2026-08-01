-- ============================================================
-- Migration 001: Core Schema Enhancements
-- QuickGuard.uk — Add missing columns, indexes, views, triggers
-- ============================================================

-- NOTE: All app tables already have primary keys and foreign keys.
--       This migration only adds missing columns and recreates views.

-- -----------------------------------------------------------------
-- 1. ADMIN HELPER FUNCTION
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = user_uuid
  );
END;
$$;

-- -----------------------------------------------------------------
-- 2. APP.USERS TABLE — Add missing columns only
-- -----------------------------------------------------------------
ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text;

ALTER TABLE app.users
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_users_user_type ON app.users(user_type);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app.users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_stripe_customer ON app.users(stripe_customer_id);

-- -----------------------------------------------------------------
-- 3. APP.GUARDS TABLE — Add missing columns only
-- -----------------------------------------------------------------
ALTER TABLE app.guards
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS plan_name text;

ALTER TABLE app.guards
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_guards_user_id ON app.guards(user_id);
CREATE INDEX IF NOT EXISTS idx_app_guards_verification_status ON app.guards(verification_status);
CREATE INDEX IF NOT EXISTS idx_app_guards_subscription_status ON app.guards(subscription_status);
CREATE INDEX IF NOT EXISTS idx_app_guards_stripe_customer ON app.guards(stripe_customer_id);

-- -----------------------------------------------------------------
-- 4. APP.CLIENTS TABLE — Add missing columns only
-- -----------------------------------------------------------------
ALTER TABLE app.clients
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS plan_name text;

ALTER TABLE app.clients
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_clients_user_id ON app.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_app_clients_verification_status ON app.clients(verification_status);
CREATE INDEX IF NOT EXISTS idx_app_clients_subscription_status ON app.clients(subscription_status);
CREATE INDEX IF NOT EXISTS idx_app_clients_stripe_customer ON app.clients(stripe_customer_id);

-- -----------------------------------------------------------------
-- 5. APP.SUBSCRIPTIONS TABLE — Add missing columns only
-- -----------------------------------------------------------------
ALTER TABLE app.subscriptions
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS plan_slug text;

ALTER TABLE app.subscriptions
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_subscriptions_user_id ON app.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_subscriptions_stripe_sub ON app.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_app_subscriptions_status ON app.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_app_subscriptions_client_id ON app.subscriptions(client_id);

-- -----------------------------------------------------------------
-- 6. APP.TRANSACTIONS TABLE — Add missing columns only
-- -----------------------------------------------------------------
ALTER TABLE app.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_transactions_user_id ON app.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_transactions_client_id ON app.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_app_transactions_guard_id ON app.transactions(guard_id);
CREATE INDEX IF NOT EXISTS idx_app_transactions_status ON app.transactions(status);
CREATE INDEX IF NOT EXISTS idx_app_transactions_stripe_session ON app.transactions(stripe_session_id);

-- -----------------------------------------------------------------
-- 7. APP.NOTIFICATIONS TABLE — Ensure defaults only
-- -----------------------------------------------------------------
ALTER TABLE app.notifications
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_id ON app.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_read ON app.notifications(read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_read ON app.notifications(user_id, read) WHERE read = false;

-- -----------------------------------------------------------------
-- 8. APP.USER_ENTITLEMENTS TABLE — Add missing columns + PK/FK
-- -----------------------------------------------------------------
ALTER TABLE app.user_entitlements
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Only add PK if table has no primary key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app.user_entitlements'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE app.user_entitlements ADD CONSTRAINT app_user_entitlements_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

-- Only add FK if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app.user_entitlements'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE app.user_entitlements
      ADD CONSTRAINT app_user_entitlements_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_user_entitlements_plan_slug ON app.user_entitlements(plan_slug);
CREATE INDEX IF NOT EXISTS idx_app_user_entitlements_status ON app.user_entitlements(subscription_status);

-- -----------------------------------------------------------------
-- 9. PUBLIC.PLANS TABLE — Add indexes only
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(active);

-- -----------------------------------------------------------------
-- 10. PUBLIC.PROCESSED_EVENTS TABLE — Add missing column + index
-- -----------------------------------------------------------------
ALTER TABLE public.processed_events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_processed_events_type ON public.processed_events(event_type);
CREATE INDEX IF NOT EXISTS idx_processed_events_created ON public.processed_events(created_at);

-- -----------------------------------------------------------------
-- 11. RECREATE PUBLIC VIEWS with new columns + security_invoker
-- -----------------------------------------------------------------

-- 11a. public.users
DROP VIEW IF EXISTS public.users;
CREATE VIEW public.users WITH (security_invoker=true) AS
SELECT
  id, email, full_name, user_type, phone,
  created_at, updated_at,
  sia_license_number, date_of_birth,
  sia_verification_status, sia_license_status,
  sia_license_expiry, sia_sectors,
  sia_verification_details, sia_verified_at,
  address, city, postcode,
  profile_photo_url, home_latitude, home_longitude, default_search_radius_km,
  stripe_customer_id, stripe_subscription_id, stripe_session_id,
  subscription_status, trial_start_date, trial_end_date,
  current_period_start, current_period_end,
  plan_slug, plan_name,
  profile_completed, verification_status
FROM app.users;

-- 11b. public.guards
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
  stripe_session_id, trial_start_date, trial_end_date,
  current_period_start, current_period_end,
  plan_slug, plan_name
FROM app.guards;

-- 11c. public.clients
DROP VIEW IF EXISTS public.clients;
CREATE VIEW public.clients WITH (security_invoker=true) AS
SELECT
  id, user_id, company_name, contact_name, email, phone,
  address_line1, address_line2, city, postcode, company_type,
  verified, total_jobs_posted, active_jobs, created_at, updated_at,
  profile_completed, first_name, last_name, industry, company_size,
  website, vat_number, billing_email, preferred_contact_method,
  hear_about_us, additional_notes, address, business_address,
  subscription_plan, subscription_tier, verification_status,
  verified_at, stripe_customer_id, payment_method_id, billing_cycle_day,
  logo_url, is_active, security_needs, total_spent, last_login,
  notes, is_suspended, client_type, client_service_tier,
  service_tier_started_at, client_signup_number, client_promo_tier,
  client_promo_starts_at, client_promo_ends_at, client_lifetime_fee_discount,
  client_promo_jobs_remaining, founding_client_badge, onboarding_status,
  subscription_status, stripe_subscription_id,
  stripe_session_id, trial_start_date, trial_end_date,
  current_period_start, current_period_end,
  plan_slug, plan_name
FROM app.clients;

-- 11d. public.subscriptions
DROP VIEW IF EXISTS public.subscriptions;
CREATE VIEW public.subscriptions WITH (security_invoker=true) AS
SELECT
  id, user_id, plan_name, stripe_subscription_id, stripe_customer_id,
  status, current_period_start, current_period_end, created_at, updated_at,
  stripe_price_id, payment_method_id, last_payment_date, next_payment_date,
  payment_status, billing_cycle, amount_paid, currency, trial_end_date,
  cancelled_at, cancellation_reason, auto_renew, payment_failure_count,
  last_payment_error, stripe_invoice_id, plan_amount, billing_interval,
  cancel_at_period_end, client_id, stripe_session_id,
  trial_start_date, plan_slug
FROM app.subscriptions;

-- 11e. public.transactions
DROP VIEW IF EXISTS public.transactions;
CREATE VIEW public.transactions WITH (security_invoker=true) AS
SELECT
  id, assignment_id, amount, transaction_type, status,
  gateway_transaction_id, gateway_name, failure_reason, metadata,
  created_at, completed_at, stripe_payment_intent, stripe_charge_id,
  stripe_invoice_id, stripe_refund_id, payment_status, currency,
  refunded, refund_amount, refunded_at, receipt_url, invoice_url,
  processed_at, stripe_session_id, client_id, guard_id, job_id,
  user_id, updated_at
FROM app.transactions;

-- 11f. public.notifications
DROP VIEW IF EXISTS public.notifications;
CREATE VIEW public.notifications WITH (security_invoker=true) AS
SELECT
  id, user_id, user_type, title, message, type, read, link,
  created_at, is_read, data, category, priority, expires_at,
  updated_at, status, sent_at, snoozed_until
FROM app.notifications;

-- 11g. public.user_entitlements
DROP VIEW IF EXISTS public.user_entitlements;
CREATE VIEW public.user_entitlements WITH (security_invoker=true) AS
SELECT
  user_id, plan_slug, plan_name, audience, features,
  monthly_price_pence, subscription_status, current_period_end,
  cancel_at_period_end, is_active, is_free_tier,
  created_at, updated_at
FROM app.user_entitlements;

-- -----------------------------------------------------------------
-- 12. AUTO-UPDATE updated_at TRIGGER
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to app tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND column_name = 'updated_at'
      AND table_name IN ('users','guards','clients','subscriptions','transactions','notifications','user_entitlements')
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_app_%I_updated_at
       BEFORE UPDATE ON app.%I
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Apply to public tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name IN ('plans','processed_events')
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;