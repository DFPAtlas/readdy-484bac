-- 031_qg_reviews_transactions_rls_repair.sql
-- QuickGuard — Reviews & Transactions RLS hardening (forward-only)
-- Canonical tables: app.reviews (reviews), app.transactions (transactions)
-- Scope: RLS policies, publication default, rating constraints, safe public views,
--         v_guard_payment_flow security mode, and privilege cleanup only.
-- No data-changing statements. No schema/table/column duplication. No reward/balance changes.

BEGIN;

-- ============================================================================
-- 1. ENABLE RLS (idempotent)
-- ============================================================================
ALTER TABLE app.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP obsolete / unsafe review policies
-- ============================================================================
DROP POLICY IF EXISTS "client_can_review" ON app.reviews;
DROP POLICY IF EXISTS "reviews_admin_all" ON app.reviews;
DROP POLICY IF EXISTS "reviews_admin_all_v2" ON app.reviews;
DROP POLICY IF EXISTS "reviews_client_insert" ON app.reviews;
DROP POLICY IF EXISTS "reviews_client_select" ON app.reviews;
DROP POLICY IF EXISTS "reviews_client_update" ON app.reviews;
DROP POLICY IF EXISTS "reviews_guard_select" ON app.reviews;
DROP POLICY IF EXISTS "reviews_service_role_all" ON app.reviews;

-- ============================================================================
-- 3. Rebuild app.reviews policies
-- ============================================================================

-- Service role: full management (explicit TO service_role)
CREATE POLICY "Service role manages reviews"
ON app.reviews
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Active super admin: full management
CREATE POLICY "Active super admins manage reviews"
ON app.reviews
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
);

-- Client reads own reviews (via clients.user_id)
CREATE POLICY "Clients read own reviews"
ON app.reviews
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM app.clients AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
);

-- Guard reads own reviews (via guards.user_id)
CREATE POLICY "Guards read own reviews"
ON app.reviews
FOR SELECT
TO authenticated
USING (
  guard_id IN (
    SELECT g.id FROM app.guards AS g
    WHERE g.user_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- 4. Drop obsolete / unsafe transaction policies
-- ============================================================================
DROP POLICY IF EXISTS "Admins read all transactions" ON app.transactions;
DROP POLICY IF EXISTS "Clients read own transactions" ON app.transactions;
DROP POLICY IF EXISTS "Guards read own transactions" ON app.transactions;
DROP POLICY IF EXISTS "Service role manages transactions" ON app.transactions;
DROP POLICY IF EXISTS "transactions_admin_select" ON app.transactions;
DROP POLICY IF EXISTS "transactions_party_select" ON app.transactions;

-- ============================================================================
-- 5. Rebuild app.transactions policies
-- ============================================================================

-- Service role: full management (explicit TO service_role)
CREATE POLICY "Service role manages transactions"
ON app.transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Active super admin: SELECT-only (no direct write to ledger)
CREATE POLICY "Active super admins read transactions"
ON app.transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
);

-- Genuine parties read own transactions (profile IDs joined through user_id)
CREATE POLICY "Parties read own transactions"
ON app.transactions
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM app.clients AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
  OR guard_id IN (
    SELECT g.id FROM app.guards AS g
    WHERE g.user_id = (SELECT auth.uid())
  )
  OR user_id = (SELECT auth.uid())
);

-- ============================================================================
-- 6. Duplicate client_reviews tables: remove weak/anon write policies
-- ============================================================================
DROP POLICY IF EXISTS "client_reviews_admin" ON public.client_reviews;
DROP POLICY IF EXISTS "client_reviews_client" ON public.client_reviews;
DROP POLICY IF EXISTS "client_reviews_guard" ON public.client_reviews;
DROP POLICY IF EXISTS "client_reviews_insert" ON public.client_reviews;
DROP POLICY IF EXISTS "Users can read own reviews" ON app.client_reviews;

-- Service role full access on both (explicit)
CREATE POLICY "Service role manages client reviews"
ON public.client_reviews
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manages client reviews"
ON app.client_reviews
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Active super admin full access on both
CREATE POLICY "Active super admins manage client reviews"
ON public.client_reviews
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
);

CREATE POLICY "Active super admins manage client reviews"
ON app.client_reviews
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active IS TRUE
      AND au.role = 'super_admin'
  )
);

-- Owner reads on duplicate tables (authenticated only)
CREATE POLICY "Clients read own reviews"
ON public.client_reviews
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM app.clients AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Guards read own reviews"
ON public.client_reviews
FOR SELECT
TO authenticated
USING (
  guard_id IN (
    SELECT g.id FROM app.guards AS g
    WHERE g.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Clients read own reviews"
ON app.client_reviews
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM app.clients AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Guards read own reviews"
ON app.client_reviews
FOR SELECT
TO authenticated
USING (
  guard_id IN (
    SELECT g.id FROM app.guards AS g
    WHERE g.user_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- 7. Publication default — new reviews must NOT default to public
--    (existing rows are untouched; admins/service role may publish explicitly)
-- ============================================================================
ALTER TABLE app.reviews ALTER COLUMN status SET DEFAULT 'hidden';

-- ============================================================================
-- 8. Category rating constraints (NULL or 1..5)
-- ============================================================================
ALTER TABLE app.reviews
  ADD CONSTRAINT reviews_punctuality_check CHECK (punctuality IS NULL OR (punctuality >= 1 AND punctuality <= 5));

ALTER TABLE app.reviews
  ADD CONSTRAINT reviews_professionalism_check CHECK (professionalism IS NULL OR (professionalism >= 1 AND professionalism <= 5));

ALTER TABLE app.reviews
  ADD CONSTRAINT reviews_communication_check CHECK (communication IS NULL OR (communication >= 1 AND communication <= 5));

ALTER TABLE app.reviews
  ADD CONSTRAINT reviews_appearance_check CHECK (appearance IS NULL OR (appearance >= 1 AND appearance <= 5));

ALTER TABLE app.reviews
  ADD CONSTRAINT reviews_reliability_check CHECK (reliability IS NULL OR (reliability >= 1 AND reliability <= 5));

-- ============================================================================
-- 9. Repair public.reviews view — public whitelist only
--     (explicit-column security_invoker view over app.reviews)
-- ============================================================================
DROP VIEW IF EXISTS public.reviews;

CREATE VIEW public.reviews WITH (security_invoker = true) AS
SELECT id,
       guard_id,
       rating,
       review_text,
       created_at
FROM app.reviews
WHERE status = 'published';

-- ============================================================================
-- 10. Repair public.transactions view — drop raw sensitive columns
-- ============================================================================
DROP VIEW IF EXISTS public.transactions;

CREATE VIEW public.transactions WITH (security_invoker = true) AS
SELECT id,
       amount,
       transaction_type,
       status,
       created_at,
       completed_at,
       currency,
       refunded,
       refund_amount,
       client_id,
       guard_id,
       job_id
FROM app.transactions;

-- ============================================================================
-- 11. Repair v_guard_payment_flow — no longer unrestricted SECURITY DEFINER
-- ============================================================================
ALTER VIEW public.v_guard_payment_flow SET (security_invoker = true);

-- ============================================================================
-- 12. Privilege cleanup — revoke anonymous writes / transaction reads
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON app.reviews, app.transactions, app.client_reviews
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.reviews, public.transactions, public.client_reviews, public.v_guard_payment_flow
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON app.transactions
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.transactions, public.v_guard_payment_flow
FROM authenticated;

COMMIT;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- SELECT * FROM pg_policies
-- WHERE schemaname IN ('app','public')
--   AND tablename IN ('reviews','client_reviews','transactions')
--   AND roles && ARRAY['public','anon']::name[]
--   AND cmd IN ('ALL','INSERT','UPDATE','DELETE');
--
-- SELECT * FROM pg_policies
-- WHERE schemaname = 'app'
--   AND tablename = 'transactions'
--   AND roles && ARRAY['authenticated']::name[]
--   AND cmd IN ('ALL','INSERT','UPDATE','DELETE');