# Client, guard and subscription journey repairs (5 October 2026)

Base: `main` at `665b465b99bd4e75d580fda61503f90981dd2c01`. Deployed Edge Functions inspected before editing (enhanced-stripe-webhook v112, create-subscription-checkout v82, check-stripe-session v58, apply-to-job v26, create-job v17, guard-shift-attendance v5, assign-guard-promo-tier v25) matched `main`.

## Findings

| # | Finding | Result | Repair |
|---|---|---|---|
| 1 | Multi-day pricing multiplied the elapsed span by days (2 × 8 h → 64 h) | Fixed | One rule — daily shift hours × `number_of_days`, overnight aware — in `lib/shift-hours.ts`, `_shared/shift-hours.ts` and `app.job_scheduled_hours()`. `select_job_guards` now computes hours, rate and gross on the server and ignores browser values. `create-job-payment` refuses (409 `booking_amount_mismatch`) and expires any open checkout for assignments whose stored amount disagrees with the schedule. |
| 2 | Mobile posting used a direct insert and a hardcoded 15 % fee | Fixed | Mobile and desktop both call `create-job` via `lib/post-job-request.ts` and load the fee through the same plan + promotion rules. `trg_enforce_client_job_post_limit` enforces the monthly limit atomically for every insert path (mobile, desktop, bulk, templates). `create-job` no longer increments usage separately (no double count; a failed insert consumes nothing). A missing repeat choice is no longer stored as recurring. |
| 3 | Apply page, job detail, saved jobs, mobile dashboard and invitations bypassed `apply-to-job` | Fixed | All five call `apply-to-job` (`lib/guard-applications.ts`), which calls `app.submit_job_application`: ownership, verification, SIA, licence, tier, duplicate and usage checks plus the insert in one serialised transaction. (The direct inserts were in fact rejected by RLS, so those screens always failed.) |
| 4 | Limit checks mixed `guards.id` and `guards.user_id` | Fixed | Browser helpers call `app.get_my_feature_usage(feature)`, which uses `auth.uid()` and takes no id. The server resolves `guards.user_id` from `guards.id` itself. `check_monthly_usage` (which accepts any user id and an increment flag) is revoked from browser roles in a final migration. |
| 5 | Invitation accepted before the application succeeded | Fixed | Acceptance happens inside `submit_job_application`; a failed application leaves the invite pending; a repeat returns the same application without consuming usage. A trigger stops browser roles marking an invite accepted directly. **Also found:** every `job_invites` update (accept and decline) and every `saved_jobs` update failed in production because a trigger sets a missing `updated_at` column; the column is added. |
| 6 | Shift confirmation ignored errors and announced success | Fixed | New `confirm_shift` action in `guard-shift-attendance` (`_shared/shift-confirmation.ts`): own assignment only, confirmed + funded booking on an active job, compare-and-set write of `guard_confirmed_at`, success only when exactly one row persists. The dashboard shows "Shift confirmed" only on that response. The old handler wrote an application status the table's CHECK constraint forbids. |
| 7 | Booking dispute screen bypassed the dispute handler | Fixed | Calls `dispute-job` → `app.raise_client_payment_dispute` (atomic dispute, independent payout hold, audit). Local state changes only after the server records the dispute; failures (for example an unfunded booking) are shown. |
| 8 | Guard subscription sync wrote `app.guards.subscription_tier` | Fixed | `_shared/subscription-profile.ts` builds updates from each table's real columns. Fixed in `enhanced-stripe-webhook` (checkout and subscription.updated), `create-subscription-checkout` (plan switch) and `check-stripe-session` (same defect, found during review). Checkout and plan-switch writes are now error- and row-checked; annual prices resolve via `stripe_annual_price_id`; unknown account types are no longer defaulted to guard. A plan switch Stripe has applied but the database has not reports `syncPending` instead of success. Stripe delivers to `enhanced-stripe-webhook` and `stripe-bank-payout-webhook` (24 h logs); the router and legacy `stripe-webhook` received nothing, so no Stripe configuration was changed. |
| 9 | `assign-guard-promo-tier` was publicly callable | Fixed | Only the service-role bearer (used by `admin-verify-guard`) or an active admin JWT is accepted, before any privileged client is created. `app.assign_guard_promo_tier` is service-role only, serialised, eligibility-checked, uses database dates, returns any existing allocation unchanged (founding benefits preserved), fails closed when `promo_config` is missing, row-checks its write and is backed by a unique index on `signup_number`. |
| 10 | Complaint, refund-review and replacement tickets skipped the Command Centre | Confirmed and fixed | No trigger hands tickets over, and live data showed today's complaint-path UAT tickets with `dfp_sync_status` unset. All four paths now call the same bridge (`lib/support-routing.ts`) with the ticket's reference, client, category and description; follow-up messages already use `dfp-support-message-bridge`, which requires the ticket to be synced first. The bridge is idempotent (upstream `x-idempotency-key`, local `synced` short-circuit) and gains a service-role retry mode (`{"retryUnsynced": true}`). Guard-raised tickets are not bridged (unchanged; the bridge is client-only). |

## Deployment order and status

Steps 1 and 2 were applied to production on 5 October 2026 (migrations recorded as 20261005222232, 222957, 223118, 223136; functions create-job v18, apply-to-job v27, assign-guard-promo-tier v26, guard-shift-attendance v6, check-stripe-session v59, calculate-job-fees v19, dfp-support-ticket-bridge v11, create-job-payment v61, enhanced-stripe-webhook v113, create-subscription-checkout v83). Steps 3–5 have not been done.

1. Apply migrations `20261005230000` → `20261005230300` (compatible with the current frontend).
2. Deploy Edge Functions, keeping existing JWT settings: `create-job` (immediately after step 1, otherwise posts are counted twice), `apply-to-job`, `assign-guard-promo-tier` (`verify_jwt = false`, internal auth), `create-job-payment`, `calculate-job-fees`, `guard-shift-attendance`, `enhanced-stripe-webhook` (`verify_jwt = false`), `create-subscription-checkout` (`verify_jwt = false`), `check-stripe-session`, `dfp-support-ticket-bridge`. Shared files: `_shared/shift-hours.ts`, `_shared/shift-confirmation.ts`, `_shared/subscription-profile.ts`, `_shared/promo-auth.ts`.
3. Merge the PR, pull it into Readdy and publish the frontend.
4. Only then apply `20261005230400_revoke_browser_usage_rpc.sql`.
5. Optional: schedule `dfp-support-ticket-bridge` with `{"retryUnsynced": true}` and the service-role bearer.

## Data needing a decision (not changed)

- `app.booking_hours_reconciliation` lists 3 assignments: the payout and dispute UAT fixtures with null `agreed_hours` / `agreed_hourly_rate` but consistent £80 gross. No live multi-day bookings exist, so no customer was over-charged by finding 1.
- `app.promo_config` has no row. After deployment, guard approval still succeeds but no signup number or promotion is assigned until a configuration row is created (fail closed).
- 4 guard entitlements use plan slug `guard-free`, which is not in `app.plans`; those guards get "Plan not found" when applying (also true before this change). Decide whether they should be `guard_starter`.
- Ticket `QG-20261005-79443` and `QG-20261005-80529` (UAT) were never sent to the Command Centre; the retry mode will send them if run.

## Verification

- `npm run test:unit`: 146 tests, 146 passing (120 existing + 26 new in `tests/journey-repairs-*.test.cjs`, plus a routing assertion in `replacement-request.test.cjs`).
- `npx tsc --noEmit`: clean. `next build`: succeeds (Google Fonts mocked because the sandbox cannot reach them).
- `scripts/checks/journey-concurrency-check.sh` on a throwaway PostgreSQL 16 cluster: concurrent promo allocations unique and gap-free; 20 concurrent applications/invite acceptances → one application, one usage unit; 10 concurrent posts on a one-post plan → one job.
- Rolled-back transactions against the live QuickGaurd database (nothing persisted, confirmed afterwards): the reconciliation view and hours function compile on the live schema; promo allocation fails closed without config, assigns signup 2 / founding with config, repeats idempotently, rejects a pending guard; invitation acceptance commits the application and acceptance together, replays without a second usage unit, rejects a duplicate.
- Edge Functions were type-checked with remote-import shims (Deno could not fetch remote modules from the sandbox).

Not verified: browser click-through of the live site (quickguard.uk is not reachable from the sandbox) and Stripe dashboard webhook configuration (no Stripe access).
