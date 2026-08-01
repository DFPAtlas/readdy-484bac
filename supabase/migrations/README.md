SUPABASE MIGRATION PLAN
=======================

Project: QuickGuard.uk
Location: supabase/migrations/


ARCHITECTURE NOTE
-----------------

  The actual tables live in the `app` schema.
  The `public` schema contains views that expose them (e.g. public.users = view of app.users).
  The app queries `public.*` via the Supabase client.
  The public views are created with `security_invoker=true` so RLS policies on the
  underlying `app` tables are enforced when users query through the views.

  public.plans and public.processed_events are actual tables (not views), so they
  get their own RLS policies directly.


FILES
-----

001_core_schema.sql
  - Adds missing columns to the `app` tables (stripe_customer_id, stripe_subscription_id,
    stripe_session_id, subscription_status, trial_start_date, trial_end_date,
    current_period_start, current_period_end, plan_slug, plan_name, profile_completed,
    verification_status, user_id, updated_at, created_at)
  - Adds primary keys and foreign keys (user_id -> auth.users.id) to `app` tables
  - Adds performance indexes on common lookup columns
  - Creates `is_admin()` helper function for RLS policies
  - Recreates all `public` views with `security_invoker=true` to include new columns
  - Creates auto-update `updated_at` trigger function and applies it to all tables

002_rls_policies.sql
  - Enables RLS on all `app` tables and the direct public tables
  - Defines policies per table:
    • Users (app.users): read/update own profile, admin access, service role update
    • Guards (app.guards): read/update/insert own row, admin access, service role
    • Clients (app.clients): read/update/insert own row, admin access, service role
    • Subscriptions (app.subscriptions): read own, admin access, service role full control
    • Plans (public.plans): public read (active), admin/service manage
    • User Entitlements (app.user_entitlements): read own, admin/service manage
    • Processed Events (public.processed_events): service role only, admin read
    • Transactions (app.transactions): read own (user_id/client_id/guard_id), admin/service manage
    • Notifications (app.notifications): read/update/delete own, admin/service manage


WHERE TO PLACE THESE FILES
--------------------------

  supabase/migrations/
  ├── 001_core_schema.sql
  ├── 002_rls_policies.sql
  └── README.md


HOW TO RUN
----------

Option A — Supabase SQL Editor (Recommended for existing data)
  1. Go to your Supabase Dashboard → SQL Editor
  2. Create a new query
  3. Paste the contents of 001_core_schema.sql and run it
  4. Paste the contents of 002_rls_policies.sql and run it
  5. Check for any errors

Option B — Supabase CLI (if you have CLI set up)
  supabase db reset        # Only if you're starting fresh
  supabase migration up    # If using CLI migrations


IMPORTANT NOTES FOR EXISTING DATA
---------------------------------

  • All ALTER TABLE statements use ADD COLUMN IF NOT EXISTS so they are safe to
    re-run if columns already exist.
  • Primary key and foreign key constraints are wrapped in DO blocks to avoid errors
    if they already exist.
  • The ON DELETE CASCADE on user_id FKs means deleting an auth.user will also
    delete the linked guard/client/subscription/entitlement row.
  • The auto-updated_at trigger applies to all tables. If you already have existing
    triggers with different names, you may see multiple triggers — this is harmless
    but you can drop the old ones if desired.
  • RLS is enabled on all underlying tables. The public views have
    `security_invoker=true`, so the app will now enforce RLS when querying through
    the public views. Make sure your app sends the Supabase auth token with every
    request.
  • The `public.guards` view previously had NO `security_invoker` flag. This
    migration recreates it with `security_invoker=true` so RLS is enforced.


VERIFICATION AFTER RUNNING
--------------------------

  -- Check all tables have RLS enabled
  SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relnamespace IN ('app'::regnamespace, 'public'::regnamespace)
    AND relname IN ('users','guards','clients','subscriptions','transactions','notifications','user_entitlements','plans','processed_events');

  -- Check policies exist
  SELECT schemaname, tablename, policyname, cmd
  FROM pg_policies
  WHERE schemaname IN ('app', 'public')
  ORDER BY schemaname, tablename, policyname;

  -- Check indexes
  SELECT schemaname, tablename, indexname
  FROM pg_indexes
  WHERE schemaname IN ('app', 'public')
    AND tablename IN ('users','guards','clients','subscriptions','transactions','notifications','user_entitlements','plans','processed_events')
  ORDER BY schemaname, tablename;

  -- Check primary keys
  SELECT conname, conrelid::regclass
  FROM pg_constraint
  WHERE contype = 'p'
    AND conrelid::regclass::text IN ('app.users','app.guards','app.clients','app.subscriptions','app.transactions','app.notifications','app.user_entitlements','public.plans','public.processed_events');


COLUMNS ADDED PER TABLE
-----------------------

  app.users:
    stripe_customer_id, stripe_subscription_id, stripe_session_id,
    subscription_status, trial_start_date, trial_end_date,
    current_period_start, current_period_end, plan_slug, plan_name,
    profile_completed, verification_status

  app.guards:
    stripe_session_id, trial_start_date, trial_end_date,
    current_period_start, current_period_end, plan_slug, plan_name

  app.clients:
    stripe_session_id, trial_start_date, trial_end_date,
    current_period_start, current_period_end, plan_slug, plan_name

  app.subscriptions:
    trial_start_date, plan_slug

  app.user_entitlements:
    created_at, updated_at

  app.transactions:
    user_id, updated_at

  public.processed_events:
    updated_at