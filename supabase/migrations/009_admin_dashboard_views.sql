-- ============================================================================
-- Migration 009: Admin Dashboard Views, RPC Functions, and Indexes
-- ============================================================================
-- Purpose:
--   - Provide fast, single-call admin KPI summaries
--   - Provide recent activity aggregation for admin dashboards
--   - Provide finance summary RPC for platform finances page
--   - Add targeted indexes for admin-heavy count/aggregate queries
--   - Ensure all admin data paths are scoped to active admins only
--
-- Security:
--   - All functions use SECURITY INVOKER (default) with safe search_path
--   - Admin-only access is enforced via is_active_admin() / is_super_admin()
--   - Underlying app tables already have RLS; these views/functions respect it
-- ============================================================================

-- ============================================================================
-- 1. Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'super_admin'
  );
$$;

-- ============================================================================
-- 2. Indexes for admin query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_admin_status ON app.jobs(status, created_at, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_jobs_admin_created ON app.jobs(created_at, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_guards_admin_verification ON app.guards(verification_status, created_at);
CREATE INDEX IF NOT EXISTS idx_guards_admin_created ON app.guards(created_at);
CREATE INDEX IF NOT EXISTS idx_guards_admin_profile ON app.guards(profile_completed, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_admin_created ON app.clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_admin_trial ON app.clients(trial_end_date, is_active) WHERE trial_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_admin_status ON app.subscriptions(status, created_at, cancelled_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_admin_status ON app.subscription_payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_admin_failed ON app.subscription_payments(status, failed_at) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_subscription_payments_admin_monthly ON app.subscription_payments(status, refunded, created_at, amount) WHERE status = 'succeeded' AND refunded = false;
CREATE INDEX IF NOT EXISTS idx_transactions_admin_status ON app.transactions(status, created_at, refunded);
CREATE INDEX IF NOT EXISTS idx_transactions_admin_completed ON app.transactions(status, created_at, refunded, amount) WHERE status = 'completed' AND refunded = false;
CREATE INDEX IF NOT EXISTS idx_support_tickets_admin_status ON app.support_tickets(status, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON app.admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_job_assignments_admin_assigned ON app.job_assignments(assigned_at, job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_admin_issues ON app.job_assignments(issue_reported, status) WHERE issue_reported = true;
CREATE INDEX IF NOT EXISTS idx_guard_payouts_admin_held ON app.guard_payouts(status) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_complaints_admin_status ON app.complaints(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sia_verifications_admin_pending ON app.sia_verifications(verification_status, created_at) WHERE verification_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_platform_costs_billing_date ON public.platform_costs(billing_date);
CREATE INDEX IF NOT EXISTS idx_reviews_issue_reported ON app.reviews(issue_reported, review_status) WHERE issue_reported = true;

-- ============================================================================
-- 3. RPC function: Admin KPI summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_kpi_summary()
RETURNS TABLE (
  total_jobs bigint,
  active_jobs bigint,
  new_jobs_this_month bigint,
  total_guards bigint,
  total_clients bigint,
  pending_verifications bigint,
  pending_sia_verifications bigint,
  open_complaints bigint,
  open_support_tickets bigint,
  open_incidents bigint,
  failed_payments bigint,
  held_payments bigint,
  monthly_revenue numeric,
  active_subscriptions bigint,
  trial_accounts bigint,
  incomplete_profiles bigint,
  new_users_this_month bigint,
  new_reviews_this_month bigint,
  total_admin_activity bigint,
  computed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Block non-admin users immediately
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH month_start AS (
    SELECT date_trunc('month', now())::timestamptz AS start
  )
  SELECT
    (SELECT count(*) FROM public.jobs WHERE is_deleted = false) AS total_jobs,
    (SELECT count(*) FROM public.jobs WHERE is_deleted = false AND status IN ('open', 'active', 'in_progress')) AS active_jobs,
    (SELECT count(*) FROM public.jobs WHERE is_deleted = false AND created_at >= (SELECT start FROM month_start)) AS new_jobs_this_month,
    (SELECT count(*) FROM public.guards) AS total_guards,
    (SELECT count(*) FROM public.clients) AS total_clients,
    (SELECT count(*) FROM public.guards WHERE verification_status = 'pending') AS pending_verifications,
    (SELECT count(*) FROM public.sia_verifications WHERE verification_status = 'pending') AS pending_sia_verifications,
    (SELECT count(*) FROM public.complaints WHERE status IN ('open', 'pending')) AS open_complaints,
    (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'pending')) AS open_support_tickets,
    (
      (SELECT count(*) FROM public.job_assignments WHERE issue_reported = true AND status IN ('assigned', 'active', 'in_progress'))
      +
      (SELECT count(*) FROM public.reviews WHERE issue_reported = true AND review_status IN ('open', 'pending', 'flagged'))
      +
      (SELECT count(*) FROM public.complaints WHERE status IN ('open', 'pending'))
      +
      (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'pending'))
    ) AS open_incidents,
    (SELECT count(*) FROM public.subscription_payments WHERE status = 'failed') + (SELECT count(*) FROM public.transactions WHERE status = 'failed') AS failed_payments,
    (SELECT count(*) FROM public.guard_payouts WHERE status = 'held') AS held_payments,
    (
      COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= (SELECT start FROM month_start)), 0)
      +
      COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= (SELECT start FROM month_start)), 0)
    ) AS monthly_revenue,
    (SELECT count(*) FROM public.subscriptions WHERE status = 'active') AS active_subscriptions,
    (SELECT count(*) FROM public.clients WHERE trial_end_date > now() AND trial_end_date IS NOT NULL) AS trial_accounts,
    (SELECT count(*) FROM public.guards WHERE profile_completed = false) AS incomplete_profiles,
    (SELECT count(*) FROM public.guards WHERE created_at >= (SELECT start FROM month_start)) + (SELECT count(*) FROM public.clients WHERE created_at >= (SELECT start FROM month_start)) AS new_users_this_month,
    (SELECT count(*) FROM public.reviews WHERE created_at >= (SELECT start FROM month_start)) AS new_reviews_this_month,
    (SELECT count(*) FROM public.admin_activity_log) AS total_admin_activity,
    now() AS computed_at;
END;
$$;

-- ============================================================================
-- 4. RPC function: Admin recent activity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_recent_activity(limit_count integer DEFAULT 20)
RETURNS TABLE (
  id text,
  event_type text,
  icon text,
  color text,
  title text,
  message text,
  time_ago text,
  created_at timestamptz,
  entity_id uuid,
  entity_type text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH all_events AS (
    SELECT
      'job-' || j.id AS evt_id,
      'job'::text AS evt_type,
      'ri-briefcase-line'::text AS evt_icon,
      'bg-teal-100 text-teal-700'::text AS evt_color,
      'Job Posted'::text AS evt_title,
      (j.job_title || ' in ' || COALESCE(j.venue_city, j.venue_name, 'unknown location'))::text AS evt_message,
      j.created_at AS evt_created_at,
      j.id AS evt_entity_id,
      'job'::text AS evt_entity_type
    FROM public.jobs j
    WHERE j.is_deleted = false AND j.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'guard-' || g.id,
      'guard',
      'ri-user-add-line',
      'bg-sky-100 text-sky-700',
      'New Guard Registered',
      COALESCE(g.full_name, 'A new guard') || ' completed registration',
      g.created_at,
      g.id,
      'guard'
    FROM public.guards g
    WHERE g.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'app-' || a.id,
      'application',
      'ri-file-list-line',
      'bg-indigo-100 text-indigo-700',
      'Job Application',
      'Guard applied to job ' || LEFT(a.job_id::text, 8),
      a.created_at,
      a.id,
      'application'
    FROM public.job_applications a
    WHERE a.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'complaint-' || c.id,
      'complaint',
      'ri-alert-line',
      'bg-amber-100 text-amber-700',
      'Complaint Filed',
      COALESCE(c.category, 'General') || ' complaint — ' || COALESCE(c.severity, 'unknown severity'),
      c.created_at,
      c.id,
      'complaint'
    FROM public.complaints c
    WHERE c.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'review-' || r.id,
      'review',
      'ri-star-fill',
      'bg-yellow-100 text-yellow-700',
      r.rating || '-Star Review',
      'New review submitted for guard ' || LEFT(r.guard_id::text, 8),
      r.created_at,
      r.id,
      'review'
    FROM public.reviews r
    WHERE r.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'verify-' || g.id,
      'verification',
      'ri-shield-check-line',
      'bg-emerald-100 text-emerald-700',
      'Guard Verified',
      COALESCE(g.full_name, 'A guard') || ' SIA licence approved',
      g.verified_at,
      g.id,
      'guard'
    FROM public.guards g
    WHERE g.verification_status = 'approved' AND g.verified_at IS NOT NULL AND g.verified_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'ticket-' || t.id,
      'ticket',
      'ri-customer-service-2-line',
      'bg-rose-100 text-rose-700',
      'Support Ticket',
      COALESCE(t.subject, 'New ticket') || ' — ' || COALESCE(t.priority, 'normal'),
      t.created_at,
      t.id,
      'ticket'
    FROM public.support_tickets t
    WHERE t.created_at >= now() - interval '7 days'

    UNION ALL

    SELECT
      'payment-' || sp.id,
      'payment',
      'ri-money-pound-circle-line',
      'bg-emerald-100 text-emerald-700',
      'Payment Received',
      '£' || sp.amount::text || ' subscription payment',
      sp.created_at,
      sp.id,
      'payment'
    FROM public.subscription_payments sp
    WHERE sp.status = 'succeeded' AND sp.created_at >= now() - interval '7 days'
  )
  SELECT
    e.evt_id,
    e.evt_type,
    e.evt_icon,
    e.evt_color,
    e.evt_title,
    e.evt_message,
    CASE
      WHEN e.evt_created_at > now() - interval '1 minute' THEN 'Just now'
      WHEN e.evt_created_at > now() - interval '1 hour' THEN EXTRACT(MINUTE FROM now() - e.evt_created_at)::integer || ' min ago'
      WHEN e.evt_created_at > now() - interval '24 hours' THEN EXTRACT(HOUR FROM now() - e.evt_created_at)::integer || ' hr' || CASE WHEN EXTRACT(HOUR FROM now() - e.evt_created_at) > 1 THEN 's' ELSE '' END || ' ago'
      WHEN e.evt_created_at > now() - interval '7 days' THEN EXTRACT(DAY FROM now() - e.evt_created_at)::integer || ' day' || CASE WHEN EXTRACT(DAY FROM now() - e.evt_created_at) > 1 THEN 's' ELSE '' END || ' ago'
      ELSE to_char(e.evt_created_at, 'DD Mon')
    END AS time_ago,
    e.evt_created_at,
    e.evt_entity_id,
    e.evt_entity_type
  FROM all_events e
  ORDER BY e.evt_created_at DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- 5. RPC function: Platform finance summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_finance_summary(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  gross_revenue numeric,
  subscription_revenue numeric,
  transaction_revenue numeric,
  stripe_fees numeric,
  running_costs numeric,
  vat_estimate numeric,
  refunds numeric,
  failed_payments numeric,
  net_revenue numeric,
  estimated_profit numeric,
  active_subscriptions bigint,
  new_subscriptions bigint,
  cancelled_subscriptions bigint,
  trial_subscriptions bigint,
  new_guards bigint,
  new_clients bigint,
  failed_payment_count bigint,
  successful_payment_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS gross_revenue,

    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS subscription_revenue,

    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS transaction_revenue,

    COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.subscription_payments WHERE status = 'succeeded' AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.transactions WHERE status = 'completed' AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS stripe_fees,

    COALESCE((SELECT SUM(monthly_cost) FROM public.platform_costs WHERE billing_date >= p_start_date::date AND billing_date <= p_end_date::date), 0) AS running_costs,

    (COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)) * 0.2 AS vat_estimate,

    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE refunded = true AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE refunded = true AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS refunds,

    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'failed' AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'failed' AND created_at >= p_start_date AND created_at <= p_end_date), 0) AS failed_payments,

    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    - (COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.subscription_payments WHERE status = 'succeeded' AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.transactions WHERE status = 'completed' AND created_at >= p_start_date AND created_at <= p_end_date), 0)) AS net_revenue,

    COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    - (COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.subscription_payments WHERE status = 'succeeded' AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(GREATEST(amount * 0.015 + 0.20, 0.20)) FROM public.transactions WHERE status = 'completed' AND created_at >= p_start_date AND created_at <= p_end_date), 0))
    - (COALESCE((SELECT SUM(amount) FROM public.subscription_payments WHERE status = 'succeeded' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)
    + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed' AND refunded = false AND created_at >= p_start_date AND created_at <= p_end_date), 0)) * 0.2
    - COALESCE((SELECT SUM(monthly_cost) FROM public.platform_costs WHERE billing_date >= p_start_date::date AND billing_date <= p_end_date::date), 0) AS estimated_profit,

    (SELECT count(*) FROM public.subscriptions WHERE status = 'active') AS active_subscriptions,
    (SELECT count(*) FROM public.subscriptions WHERE created_at >= p_start_date AND created_at <= p_end_date) AS new_subscriptions,
    (SELECT count(*) FROM public.subscriptions WHERE cancelled_at >= p_start_date AND cancelled_at <= p_end_date) AS cancelled_subscriptions,
    (SELECT count(*) FROM public.subscriptions WHERE status = 'trialing') AS trial_subscriptions,
    (SELECT count(*) FROM public.guards WHERE created_at >= p_start_date AND created_at <= p_end_date) AS new_guards,
    (SELECT count(*) FROM public.clients WHERE created_at >= p_start_date AND created_at <= p_end_date) AS new_clients,
    (SELECT count(*) FROM public.subscription_payments WHERE status = 'failed' AND created_at >= p_start_date AND created_at <= p_end_date)
    + (SELECT count(*) FROM public.transactions WHERE status = 'failed' AND created_at >= p_start_date AND created_at <= p_end_date) AS failed_payment_count,
    (SELECT count(*) FROM public.subscription_payments WHERE status = 'succeeded' AND created_at >= p_start_date AND created_at <= p_end_date)
    + (SELECT count(*) FROM public.transactions WHERE status = 'completed' AND created_at >= p_start_date AND created_at <= p_end_date) AS successful_payment_count;
END;
$$;

-- ============================================================================
-- 6. RPC function: Subscription metrics (MRR, ARR, churn)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_subscription_metrics()
RETURNS TABLE (
  mrr numeric,
  arr numeric,
  arpu numeric,
  active_count bigint,
  trialing_count bigint,
  cancelled_count bigint,
  total_count bigint,
  churn_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH active_subs AS (
    SELECT plan_amount FROM public.subscriptions WHERE status = 'active'
  ),
  last_month AS (
    SELECT count(*) AS cnt FROM public.subscriptions
    WHERE created_at <= date_trunc('month', now()) - interval '1 month'
    AND (status = 'active' OR (cancelled_at > date_trunc('month', now()) - interval '1 month'))
  ),
  cancelled_last_month AS (
    SELECT count(*) AS cnt FROM public.subscriptions
    WHERE cancelled_at >= date_trunc('month', now()) - interval '1 month'
    AND cancelled_at < date_trunc('month', now())
  )
  SELECT
    COALESCE((SELECT SUM(plan_amount / 100) FROM active_subs), 0) AS mrr,
    COALESCE((SELECT SUM(plan_amount / 100) FROM active_subs), 0) * 12 AS arr,
    CASE WHEN (SELECT count(*) FROM active_subs) > 0
      THEN COALESCE((SELECT SUM(plan_amount / 100) FROM active_subs), 0) / (SELECT count(*) FROM active_subs)
      ELSE 0
    END AS arpu,
    (SELECT count(*) FROM public.subscriptions WHERE status = 'active') AS active_count,
    (SELECT count(*) FROM public.subscriptions WHERE status = 'trialing') AS trialing_count,
    (SELECT count(*) FROM public.subscriptions WHERE status = 'cancelled') AS cancelled_count,
    (SELECT count(*) FROM public.subscriptions) AS total_count,
    CASE WHEN (SELECT cnt FROM last_month) > 0
      THEN (SELECT cnt FROM cancelled_last_month)::numeric / (SELECT cnt FROM last_month)::numeric
      ELSE 0
    END AS churn_rate;
END;
$$;

-- ============================================================================
-- 7. RPC function: Platform alert summary (for dashboard alerts panel)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_alert_summary()
RETURNS TABLE (
  alert_type text,
  alert_title text,
  alert_message text,
  alert_count bigint,
  action_href text,
  action_label text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pending_verifications bigint;
  v_pending_sia bigint;
  v_open_complaints bigint;
  v_failed_payments bigint;
  v_held_payments bigint;
  v_open_tickets bigint;
  v_expiring_soon bigint;
BEGIN
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_pending_verifications FROM public.guards WHERE verification_status = 'pending';
  SELECT count(*) INTO v_pending_sia FROM public.sia_verifications WHERE verification_status = 'pending';
  SELECT count(*) INTO v_open_complaints FROM public.complaints WHERE status IN ('open', 'pending');
  SELECT count(*) INTO v_failed_payments FROM public.subscription_payments WHERE status = 'failed';
  v_failed_payments := v_failed_payments + (SELECT count(*) FROM public.transactions WHERE status = 'failed');
  SELECT count(*) INTO v_held_payments FROM public.guard_payouts WHERE status = 'held';
  SELECT count(*) INTO v_open_tickets FROM public.support_tickets WHERE status IN ('open', 'pending');
  SELECT count(*) INTO v_expiring_soon FROM public.subscriptions
  WHERE status = 'active' AND current_period_end IS NOT NULL
  AND current_period_end > now() AND current_period_end <= now() + interval '14 days';

  IF v_pending_verifications > 0 THEN
    RETURN QUERY SELECT 'warning'::text, (v_pending_verifications || ' Guard' || CASE WHEN v_pending_verifications > 1 THEN 's' ELSE '' END || ' Awaiting Verification')::text, 'Pending profile checks require admin review to unblock guard availability.'::text, v_pending_verifications, '/admin/guard-verifications'::text, 'Review Now'::text;
  END IF;
  IF v_pending_sia > 0 THEN
    RETURN QUERY SELECT 'warning'::text, (v_pending_sia || ' SIA Licence' || CASE WHEN v_pending_sia > 1 THEN 's' ELSE '' END || ' Pending')::text, 'SIA licence verifications need admin approval.'::text, v_pending_sia, '/admin/sia-verifications'::text, 'Verify'::text;
  END IF;
  IF v_open_complaints > 0 THEN
    RETURN QUERY SELECT 'critical'::text, (v_open_complaints || ' Open Complaint' || CASE WHEN v_open_complaints > 1 THEN 's' ELSE '' END)::text, 'Unresolved complaints need admin attention.'::text, v_open_complaints, '/admin/complaints'::text, 'Investigate'::text;
  END IF;
  IF v_open_tickets > 0 THEN
    RETURN QUERY SELECT 'critical'::text, (v_open_tickets || ' Open Support Ticket' || CASE WHEN v_open_tickets > 1 THEN 's' ELSE '' END)::text, 'Open support tickets awaiting resolution.'::text, v_open_tickets, '/admin/support-tickets'::text, 'Resolve'::text;
  END IF;
  IF v_failed_payments > 0 THEN
    RETURN QUERY SELECT 'critical'::text, (v_failed_payments || ' Failed Payment' || CASE WHEN v_failed_payments > 1 THEN 's' ELSE '' END)::text, 'Recent payment failures require review and retry.'::text, v_failed_payments, '/admin/failed-payments'::text, 'Review'::text;
  END IF;
  IF v_held_payments > 0 THEN
    RETURN QUERY SELECT 'warning'::text, (v_held_payments || ' Held Payout' || CASE WHEN v_held_payments > 1 THEN 's' ELSE '' END)::text, 'Guard payouts are on hold and need admin release.'::text, v_held_payments, '/admin/held-payments'::text, 'Release'::text;
  END IF;
  IF v_expiring_soon > 0 THEN
    RETURN QUERY SELECT 'info'::text, (v_expiring_soon || ' Subscription' || CASE WHEN v_expiring_soon > 1 THEN 's' ELSE '' END || ' Expiring Soon')::text, 'Subscriptions expire in the next 14 days.'::text, v_expiring_soon, '/admin/subscription-management'::text, 'Manage'::text;
  END IF;
  IF v_pending_verifications = 0 AND v_pending_sia = 0 AND v_open_complaints = 0 AND v_open_tickets = 0 AND v_failed_payments = 0 AND v_held_payments = 0 AND v_expiring_soon = 0 THEN
    RETURN QUERY SELECT 'info'::text, 'All Systems Normal'::text, 'No pending verifications, complaints, or payment issues. Dashboard is clear.'::text, 0::bigint, '/admin/activity-log'::text, 'View Activity'::text;
  END IF;
END;
$$;

-- ============================================================================
-- 8. Views (wrappers for the functions)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_admin_kpi_summary AS
SELECT * FROM public.get_admin_kpi_summary();

CREATE OR REPLACE VIEW public.v_admin_recent_activity AS
SELECT * FROM public.get_admin_recent_activity(20);

-- ============================================================================
-- 9. RLS enforcement note
-- ============================================================================
-- The underlying app tables already have RLS policies that:
--   - Restrict clients to their own rows (client_id / user_id match)
--   - Restrict guards to their own rows (guard_id / user_id match)
--   - Allow admins full access via is_active_admin()
-- These new views and functions are SECURITY INVOKER and query the public
-- views, which resolve to the app tables. RLS is enforced at the app table
-- level. No additional SECURITY DEFINER functions are needed.
-- ============================================================================