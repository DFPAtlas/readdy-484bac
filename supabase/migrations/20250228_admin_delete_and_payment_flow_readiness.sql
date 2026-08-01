-- ============================================================
-- QUICKGUARD SUPABASE READINESS MIGRATION
-- Admin Delete + Guard Payment Flow Dashboard
-- Created: 2025-02-28
-- NOTE: Real data tables live in app.* schema.
--       public.* contains convenience views.
--       Indexes go on app.* tables.
--       View + RPCs go on public schema.
-- ============================================================

-- PART 1: ADMIN DELETION AUDIT TABLE (public schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_deletion_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('guard', 'client')),
  reason text NOT NULL,
  dry_run boolean DEFAULT false,
  deleted_tables jsonb DEFAULT ''::jsonb,
  deleted_storage_files jsonb DEFAULT '[]'::jsonb,
  retained_records jsonb DEFAULT ''::jsonb,
  anonymised_records jsonb DEFAULT ''::jsonb,
  failed_items jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed', 'dry_run')),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_deletion_audit_admin
  ON public.admin_deletion_audit_log (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_deletion_audit_target
  ON public.admin_deletion_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_deletion_audit_type
  ON public.admin_deletion_audit_log (target_type);
CREATE INDEX IF NOT EXISTS idx_admin_deletion_audit_status
  ON public.admin_deletion_audit_log (status);
CREATE INDEX IF NOT EXISTS idx_admin_deletion_audit_created
  ON public.admin_deletion_audit_log (created_at);

-- ============================================================
-- PART 2: PERFORMANCE INDEXES (on app.* base tables)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_guards_user_id ON app.guards (user_id);
CREATE INDEX IF NOT EXISTS idx_guards_is_active ON app.guards (is_active);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON app.clients (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON app.clients (is_active);

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON app.jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON app.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON app.jobs (payment_status);

CREATE INDEX IF NOT EXISTS idx_job_assignments_guard_id ON app.job_assignments (guard_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON app.job_assignments (job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_payment_status ON app.job_assignments (payment_status);

CREATE INDEX IF NOT EXISTS idx_guard_payouts_guard_id ON app.guard_payouts (guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_job_id ON app.guard_payouts (job_id);
CREATE INDEX IF NOT EXISTS idx_guard_payouts_status ON app.guard_payouts (status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON app.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_guard_id ON app.transactions (guard_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON app.transactions (client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON app.transactions (job_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON app.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_guard_id ON app.job_applications (guard_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON app.job_applications (job_id);

CREATE INDEX IF NOT EXISTS idx_sia_verifications_guard_id ON app.sia_verifications (guard_id);

CREATE INDEX IF NOT EXISTS idx_guard_bank_details_guard_id ON app.guard_bank_details (guard_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON app.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON app.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON app.messages (receiver_id);

-- ============================================================
-- PART 3: PAYMENT FLOW VIEW — public.v_guard_payment_flow
-- References app.* tables directly for performance
-- ============================================================
CREATE OR REPLACE VIEW public.v_guard_payment_flow AS
WITH job_payment AS (
  SELECT
    ja.guard_id, ja.job_id, ja.id AS assignment_id,
    j.client_id, j.job_title,
    j.agreed_amount AS amount,
    COALESCE(j.currency, 'gbp') AS currency,
    j.start_date AS job_date,
    CASE WHEN j.venue_name IS NOT NULL THEN j.venue_name
         WHEN j.venue_city IS NOT NULL THEN j.venue_city
         ELSE j.city END AS site_name,
    cl.contact_name AS client_name,
    ja.status AS assignment_status,
    ja.payment_status AS assignment_payment_status,
    j.status AS job_status,
    j.payment_status AS job_payment_status,
    j.client_confirmed, j.client_confirmed_at,
    j.disputed, j.disputed_at, j.disputed_reason,
    ja.completed_at AS assignment_completed_at,
    ja.check_in_time, ja.check_out_time,
    ja.payout_id, ja.payout_initiated_at
  FROM app.job_assignments ja
  LEFT JOIN app.jobs j ON ja.job_id = j.id
  LEFT JOIN app.clients cl ON j.client_id = cl.id
),
latest_payout AS (
  SELECT DISTINCT ON (guard_id, job_id)
    guard_id, job_id,
    status AS payout_status, failure_reason,
    completed_date AS payout_completed_date,
    stripe_transfer_id,
    created_at AS payout_created_at,
    updated_at AS payout_updated_at
  FROM app.guard_payouts
  ORDER BY guard_id, job_id, created_at DESC
),
latest_transaction AS (
  SELECT DISTINCT ON (guard_id, job_id)
    guard_id, job_id,
    status AS transaction_status,
    failure_reason AS transaction_failure_reason,
    stripe_payment_intent,
    completed_at AS transaction_completed_at,
    created_at AS transaction_created_at
  FROM app.transactions
  WHERE guard_id IS NOT NULL
  ORDER BY guard_id, job_id, created_at DESC
),
latest_completion AS (
  SELECT DISTINCT ON (guard_id, job_id)
    guard_id, job_id,
    status AS completion_status,
    client_approved_at, client_disputed_at,
    dispute_reason AS completion_dispute_reason,
    updated_at AS completion_updated_at
  FROM app.job_completion_requests
  ORDER BY guard_id, job_id, updated_at DESC
)
SELECT
  jp.guard_id, jp.job_id, jp.assignment_id, jp.client_id,
  jp.job_title, jp.client_name, jp.site_name,
  jp.job_date, jp.amount, jp.currency,

  -- Stage 1: Funds Held
  CASE
    WHEN lt.stripe_payment_intent IS NOT NULL
      AND lt.transaction_status IN ('succeeded', 'completed', 'paid', 'complete')
      THEN 'complete'
    WHEN jp.job_payment_status IN ('paid', 'succeeded', 'complete', 'completed', 'funded', 'held')
      THEN 'complete'
    WHEN jp.assignment_payment_status IN ('paid', 'held', 'funded')
      THEN 'complete'
    WHEN lt.transaction_status IN ('pending', 'processing', 'awaiting_payment') THEN 'pending'
    WHEN jp.job_payment_status IN ('pending', 'processing', 'awaiting_payment') THEN 'pending'
    WHEN lt.transaction_status IN ('failed', 'cancelled', 'refunded') THEN 'failed'
    WHEN jp.job_payment_status IN ('failed', 'cancelled', 'refunded') THEN 'failed'
    WHEN lt.stripe_payment_intent IS NOT NULL THEN 'pending'
    ELSE 'not_started'
  END AS stage_1_status,
  'Funds Held' AS stage_1_label,
  CASE WHEN lt.stripe_payment_intent IS NOT NULL
    AND lt.transaction_status IN ('succeeded', 'completed', 'paid', 'complete')
    THEN GREATEST(COALESCE(lt.transaction_completed_at, '1970-01-01'::timestamptz),
                  COALESCE(jp.client_confirmed_at, '1970-01-01'::timestamptz))
    ELSE NULL
  END AS stage_1_timestamp,

  -- Stage 2: Client Released
  CASE
    WHEN jp.client_confirmed = true THEN 'complete'
    WHEN jp.disputed = true THEN 'failed'
    WHEN lc.completion_status IN ('approved', 'client_approved', 'completed') THEN 'complete'
    WHEN lc.completion_status IN ('disputed', 'client_disputed') THEN 'failed'
    WHEN lc.completion_status = 'pending' THEN 'pending'
    WHEN jp.assignment_status = 'completed' THEN 'pending'
    WHEN jp.assignment_status IN ('active', 'check_in', 'checked_in') THEN 'in_progress'
    WHEN jp.check_in_time IS NOT NULL AND jp.check_out_time IS NULL THEN 'in_progress'
    WHEN jp.check_out_time IS NOT NULL THEN 'pending'
    ELSE 'not_started'
  END AS stage_2_status,
  'Client Released' AS stage_2_label,
  CASE WHEN jp.client_confirmed = true THEN jp.client_confirmed_at
       WHEN lc.completion_status IN ('approved', 'client_approved', 'completed') THEN lc.client_approved_at
       WHEN lc.completion_status = 'pending' THEN lc.completion_updated_at
       WHEN jp.assignment_status = 'completed' THEN jp.assignment_completed_at
       ELSE NULL
  END AS stage_2_timestamp,

  -- Stage 3: Guard Paid
  CASE
    WHEN lp.stripe_transfer_id IS NOT NULL
      AND lp.payout_status IN ('paid', 'completed', 'transferred', 'payout_paid', 'payout_completed', 'transfer_succeeded')
      THEN 'complete'
    WHEN lp.payout_status IN ('paid', 'completed', 'transferred', 'transfer_succeeded', 'payout_completed', 'payout_paid')
      THEN 'complete'
    WHEN lp.payout_status IN ('pending', 'processing', 'payout_pending', 'transfer_pending') THEN 'pending'
    WHEN lp.payout_status IN ('failed', 'payout_failed', 'transfer_failed', 'requires_review') THEN 'failed'
    WHEN jp.payout_id IS NOT NULL THEN 'pending'
    ELSE 'not_started'
  END AS stage_3_status,
  'Guard Paid' AS stage_3_label,
  CASE WHEN lp.payout_status IN ('paid', 'completed', 'transferred', 'transfer_succeeded', 'payout_completed', 'payout_paid')
       THEN lp.payout_completed_date
       WHEN lp.payout_status IN ('pending', 'processing', 'payout_pending', 'transfer_pending')
       THEN lp.payout_updated_at
       ELSE NULL
  END AS stage_3_timestamp,

  COALESCE(lp.failure_reason, lc.completion_dispute_reason, jp.disputed_reason, lt.transaction_failure_reason) AS failure_reason,

  CASE WHEN lp.payout_status IN ('failed', 'transfer_failed', 'requires_review') THEN true
       WHEN jp.disputed = true THEN true
       WHEN lc.completion_status IN ('disputed', 'client_disputed') THEN true
       WHEN lt.transaction_status IN ('failed', 'cancelled') THEN true
       ELSE false
  END AS requires_action,

  GREATEST(
    COALESCE(jp.client_confirmed_at, '1970-01-01'::timestamptz),
    COALESCE(jp.assignment_completed_at, '1970-01-01'::timestamptz),
    COALESCE(lp.payout_updated_at, '1970-01-01'::timestamptz),
    COALESCE(lt.transaction_completed_at, '1970-01-01'::timestamptz),
    COALESCE(lc.completion_updated_at, '1970-01-01'::timestamptz)
  ) AS updated_at
FROM job_payment jp
LEFT JOIN latest_transaction lt ON jp.guard_id = lt.guard_id AND jp.job_id = lt.job_id
LEFT JOIN latest_payout lp ON jp.guard_id = lp.guard_id AND jp.job_id = lp.job_id
LEFT JOIN latest_completion lc ON jp.guard_id = lc.guard_id AND jp.job_id = lc.job_id;

-- ============================================================
-- PART 4: RPC FUNCTIONS
-- ============================================================

-- 4a. Get payment flow for a specific guard
CREATE OR REPLACE FUNCTION public.get_guard_payment_flow(p_guard_id uuid)
RETURNS SETOF public.v_guard_payment_flow
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.v_guard_payment_flow
  WHERE guard_id = p_guard_id
  ORDER BY updated_at DESC;
$$;

-- 4b. Admin payment flow summary
CREATE OR REPLACE FUNCTION public.get_admin_payment_flow_summary()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_jobs_with_payments', (SELECT COUNT(DISTINCT job_id) FROM public.v_guard_payment_flow),
    'funds_held_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_1_status = 'complete'),
    'waiting_client_release_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_1_status = 'complete' AND stage_2_status IN ('pending', 'in_progress')),
    'payout_pending_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_2_status = 'complete' AND stage_3_status IN ('pending', 'not_started')),
    'payout_failed_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_3_status = 'failed'),
    'disputed_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_2_status = 'failed' OR failure_reason ILIKE '%dispute%'),
    'requires_action_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE requires_action = true),
    'complete_flow_count', (SELECT COUNT(*) FROM public.v_guard_payment_flow WHERE stage_1_status = 'complete' AND stage_2_status = 'complete' AND stage_3_status = 'complete')
  );
$$;

-- 4c. Dry-run deletion impact checker
CREATE OR REPLACE FUNCTION public.admin_delete_user_dry_run(
  p_user_id uuid,
  p_user_type text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_target_user_id uuid;
  v_target_record_id uuid;
  v_result jsonb;
  v_cnt integer;
  v_total integer := 0;
BEGIN
  IF p_user_type NOT IN ('guard', 'client') THEN
    RETURN jsonb_build_object('error', 'user_type must be guard or client');
  END IF;

  v_target_record_id := p_user_id;

  IF p_user_type = 'guard' THEN
    SELECT user_id INTO v_target_user_id FROM app.guards WHERE id = p_user_id;
    IF v_target_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Guard not found');
    END IF;

    SELECT COUNT(*) INTO v_cnt FROM app.guard_bank_details WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.guard_payouts WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.job_applications WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.job_assignments WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.job_completion_requests WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.sia_verifications WHERE guard_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.messages WHERE sender_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.messages WHERE receiver_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.notifications WHERE user_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
  ELSE
    SELECT user_id INTO v_target_user_id FROM app.clients WHERE id = p_user_id;
    IF v_target_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Client not found');
    END IF;

    SELECT COUNT(*) INTO v_cnt FROM app.jobs WHERE client_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.client_documents WHERE client_id = v_target_record_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.messages WHERE sender_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.messages WHERE receiver_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
    SELECT COUNT(*) INTO v_cnt FROM app.notifications WHERE user_id = v_target_user_id; IF v_cnt > 0 THEN v_total := v_total + v_cnt; END IF;
  END IF;

  SELECT jsonb_build_object(
    'target_user_id', v_target_user_id,
    'target_record_id', v_target_record_id,
    'user_type', p_user_type,
    'non_financial_rows', v_total,
    'financial_rows_subscriptions', COALESCE((SELECT COUNT(*) FROM app.subscriptions WHERE user_id = v_target_user_id), 0),
    'financial_rows_subscription_payments', COALESCE((SELECT COUNT(*) FROM app.subscription_payments WHERE user_id = v_target_user_id), 0),
    'financial_rows_transactions', COALESCE((SELECT COUNT(*) FROM app.transactions WHERE guard_id = v_target_record_id OR client_id = v_target_record_id), 0),
    'financial_rows_payment_events', COALESCE((SELECT COUNT(*) FROM app.payment_events WHERE user_id = v_target_user_id), 0),
    'financial_rows_payment_audit_logs', COALESCE((SELECT COUNT(*) FROM app.payment_audit_logs WHERE guard_id = v_target_record_id OR client_id = v_target_record_id), 0),
    'users_row_count', COALESCE((SELECT COUNT(*) FROM app.users WHERE id = v_target_user_id), 0),
    'total_affected_rows', v_total
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- PART 5: RLS POLICIES
-- ============================================================

-- 5a. admin_deletion_audit_log — only super_admin can read
ALTER TABLE public.admin_deletion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read deletion audit log"
  ON public.admin_deletion_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = 'super_admin'
        AND admin_users.is_active = true
    )
  );

-- 5b. app.guard_payouts: guard sees own, admin sees all
ALTER TABLE app.guard_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards read own payouts"
  ON app.guard_payouts FOR SELECT
  USING (guard_id IN (SELECT id FROM app.guards WHERE user_id = auth.uid()));

CREATE POLICY "Admins read all payouts"
  ON app.guard_payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM app.admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- 5c. app.transactions: guard + client + admin
ALTER TABLE app.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards read own transactions"
  ON app.transactions FOR SELECT
  USING (guard_id IN (SELECT id FROM app.guards WHERE user_id = auth.uid()));

CREATE POLICY "Clients read own transactions"
  ON app.transactions FOR SELECT
  USING (client_id IN (SELECT id FROM app.clients WHERE user_id = auth.uid()));

CREATE POLICY "Admins read all transactions"
  ON app.transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM app.admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- 5d. app.job_completion_requests
ALTER TABLE app.job_completion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards read own completion requests"
  ON app.job_completion_requests FOR SELECT
  USING (guard_id IN (SELECT id FROM app.guards WHERE user_id = auth.uid()));

CREATE POLICY "Clients read own completion requests"
  ON app.job_completion_requests FOR SELECT
  USING (client_id IN (SELECT id FROM app.clients WHERE user_id = auth.uid()));

CREATE POLICY "Admins read all completion requests"
  ON app.job_completion_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM app.admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- NOTE: No frontend user can DELETE records directly.
-- Deletion is Edge Function / service-role only.

-- ============================================================
-- END OF MIGRATION
-- ============================================================