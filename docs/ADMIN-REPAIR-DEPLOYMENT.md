# Admin repair and deployment record — 3 October 2026

This branch includes the finance changes from PR 26 and the wider admin repairs. Merge this branch once reviewed; do not separately merge an older version of the finance handlers. This is a source repair, not production launch sign-off.

## Changes

- Collected, refunded and remaining amounts share one calculation. Partial refunds count in dashboard, payment details, CSV and monthly snapshots. Client funds are not labelled earned platform revenue; processing fees and tax/profit values remain explicitly estimates.
- Payments and operations come first on Finance, with analytics and costs separate. Insufficient history is reflected in health and alerts.
- Job badges and filters include Confirmed and every current stored lifecycle state. Unknown states are visible rather than silently labelled Open.
- Both job-payment surfaces use the same refund-aware table and canonical completion/dispute workflows. Manual payment-state mutation is rejected server-side; bulk lifecycle rewrites are blocked.
- Completion requests call the actual approval handler. Dispute controls show remaining refundable funds, validate amount, require acknowledgement and report backend errors. Direct payout attempts require finance role and MFA.
- Refunds and payouts reserve a durable per-job operation. Concurrent or uncertain operations cannot trigger another money movement. Completed operations replay their result. Stripe idempotency is retained.
- Approved refunds use actual Stripe remaining funds, including partial-then-full. Refund transaction, job, assignment, dispute and audit writes commit together. Pending refunds remain held for reconciliation. Partial bookings keep their valid funded operational state; payout verification rejects any recorded or Stripe refund.
- Full refunds cancel/refund assignments and jobs together. Webhooks read current Stripe charge state to avoid applying a stale partial event over a later full refund.
- Financial audit inserts use the current schema and required to_status. Core audit failures surface instead of returning misleading success.
- Uncertain operations appear in Finance. No automatic timeout unlock is provided: an uncertain Stripe response must be reconciled before recovery.
- Support ticket cards open Support Tickets. Local payment test notes are explicitly labelled as browser-only evidence. Legacy admin query relation/type errors are repaired.
- Static job detail links use a query route. Next, PostCSS and sharp dependencies are patched and pinned; the production npm audit reports zero known vulnerabilities.
- CI now enforces admin/financial frontend typing and financial regression tests. The full repository TypeScript report remains available; existing client/guard typing debt is not silently represented as passing. Lint runs with punctuation/const-style warnings; correctness rules still fail builds.

## Validation

- Production Next build passes.
- Admin/financial frontend type gate passes; full repository typecheck still reports existing client/guard/shared-component errors.
- Admin lint: zero errors; existing hook, image and style warnings remain.
- 25 regression tests: 10 booking/fee, 3 amount reconciliation, 6 PostgreSQL operation/refund tests and 6 tests of the actual refund/dispute HTTP handlers with mocked Stripe/database boundaries.
- PostgreSQL tests cover reservation/replay, active/uncertain operation exclusion, partial-then-full, audit-failure rollback, pending refunds, over-refund/payout blocking and RPC permissions.
- HTTP handler tests also prove an early transfer webhook cannot be downgraded by the dispute handler; they cover session/role/MFA denial, payout-blocking before Stripe, remaining £72 amount, replay without another refund and reconciliation after Stripe/local-write failure.
- Financial function syntax checks pass. Full Deno dependency/type verification was blocked by remote import connectivity; run the deployment check against the exact packaged files.
- These tests do not prove Stripe Dashboard delivery, admin UI submission, actual guard transfer, multi-process race behaviour or all 59 routes end to end.

## Deployment order

1. Review and merge this branch. Keep a record of the currently deployed function versions and frontend version.
2. Apply `supabase/migrations/20261003114129_admin_financial_operation_safety.sql`. The prior partially_refunded transaction migration must already be applied.
3. Deploy `execute-job-refund`, `resolve-dispute`, `create-guard-payout`, `admin-job-mutate`, `monthly-finance-snapshot` and `enhanced-stripe-webhook`, including `_shared/financialOperations.ts`. Snapshot also imports `lib/financeAmounts.ts`; include it in the bundle. Keep JWT verification on authenticated functions; webhook JWT verification remains off with Stripe signature verification on. Do not replace deployed secrets.
4. Verify the finance roles can read financial_operations and browser roles cannot execute its write RPCs. Re-run database advisors after migration.
5. Pull GitHub into Readdy, then Publish.
6. Verify the new frontend and backend together in the existing QuickGuard sandbox before any live activation.

The additive migration must precede financial handler deployment. Do not remove financial_operations or clear processing/reconciliation rows during rollback. Reverting to handlers without the gate would remove the money-movement protection; disable affected actions while investigating instead.

## Required deployed sandbox acceptance

- Admin-initiated partial and full refund; a fresh automatic full refund; partial-then-remaining full refund.
- Double click and replay send one refund/transfer only; actual Stripe/database/audit IDs reconcile.
- Started payout rejects refund and refunded payment rejects payout. Exercise refund/payout requests concurrently against deployed handlers.
- Stripe timeout/DB or audit failure holds the operation and presents finance review; no repeated money movement.
- Successful transfer is evidenced by Stripe and webhook updates; approving completion alone is not proof of payout.
- MFA and non-finance role denial through the deployed API; expired sessions, queue errors, pagination/export totals and mobile/keyboard review.
- People/SIA, subscriptions, support and email operational workflows still need their own end-to-end tests. No test email or money movement was sent during this branch repair.

## Reconciliation procedure

For a held operation, check Stripe by its stored refund/transfer ID, operation metadata and Stripe idempotency key. Compare transaction, assignment, payout and audit records. For a pending refund, the matching successful webhook can complete a known operation. An operation with no known Stripe ID remains held; a verified operator must record recovery after establishing whether the external call occurred. Never mark an uncertain operation failed simply to enable a new Stripe request.

## Readiness report dispositions

| Finding | Source disposition | Remaining evidence |
| --- | --- | --- |
| Status-only release | Removed; real approval/dispute workflows | Deployed guard transfer |
| Refund audit mismatch | Fixed; atomic refund RPC | Deployed admin refund |
| Financial UAT unfinished | Local regression coverage added | Full sandbox checklist above |
| Missing partial refund totals | Shared calculations | Published regression |
| Misleading net/detail values | Collected/refunded/remaining shown; estimates labelled | Actual Stripe fees/bank settlement |
| Confirmed job shown Open | Shared status map and filters | Published filter regression |
| Missing payment refund context | Shared refund-aware table; finance-review indicator | Published regression |
| Dashboard drops partial payments | Shared retained-fund calculations | Published totals |
| Tickets open complaints | Correct destination | Published click |
| Health contradicts alerts | Insufficient-history display aligned | Published regression |
| Retry/concurrency risk | Durable gate and idempotency; atomic refund records | Deployed race/failure tests |
| Typing/lint gap | Admin gate and regressions enforced; lint installed | Legacy non-admin type debt |
| Finance layout | Operations/payments first; analytics/costs separate | Mobile/keyboard review |
| Overlapping admin surfaces | Job payment/dispute surfaces share canonical components | Wider people/subscription navigation review |
| Local timeline treated as audit | Explicit local-notes label and shared activity link | Published regression |
| Dependency advisory | Patched dependencies; zero production audit findings | Post-publish auth/payment regression |

## Existing Supabase advisor notices

Read-only advisor scan still reports extension-owned `public.spatial_ref_sys` without RLS; PostGIS in public; security-definer functions (maintenance settings, admin checks/summary/delete dry run, PostGIS estimated extent); and disabled leaked-password protection. These have not been broadly revoked or moved, which could break dependent workflows. They require access-model review rather than assuming every security-definer function is unsafe.

References: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Dependency references: https://nextjs.org/blog (September 2026 security release), https://github.com/advisories/GHSA-fxqj-rqcc-2cmp, https://github.com/advisories/GHSA-rgj7-g3m4-5g8c.
