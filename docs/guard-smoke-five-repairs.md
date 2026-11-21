# Guard smoke repairs G01–G05

This release addresses the five areas demonstrated by the 21 November guard
smoke. The accepted client repair scope remains closed.

| Area | Result |
|---|---|
| G01 | Active guard discovery and application controls use the UK calendar date. Saved/old job pages remain readable. A private, invoker-rights BEFORE INSERT trigger rejects a missing or elapsed job date, including direct/RPC/invitation entry points. Its exception rolls back application quota and invitation writes. Existing applications and idempotent invitation replays remain unchanged. |
| G02 | Selected has a distinct dashboard/history count and filter; confirmed remains an accepted-offer alias. Guard history selects deployed columns, exposes application/assignment IDs for caller-owned hydration, and reports related read failures. Mobile applications and assignments use that owned history response rather than public job embeds. Published-review visibility is preserved; hidden reviews are excluded. |
| G03 | History and mobile paid earnings come from recorded payout receipts. Earnings recognises paid_out, preserves zero net amounts and fees, and hydrates job details without nonexistent fields. Cancelled job face values do not become income. Gross, net, pending, Stripe transfers and bank deposits retain their distinct meanings. Failed reads show recovery instead of zero balances. |
| G04 | Payment Centre and mobile reuse the verified payout-settings workflow. Cached guard flags cannot assert current readiness. Checking/failed status withholds setup actions; explicit refresh clears prior verified status. Stripe account links remain caller-bound and provider-host validated. |
| G05 | One read-side category classifier drives guard notification filtering and labels. Modern semantic types/categories take precedence; recognised legacy payout/application titles remain discoverable. No old notification rows, ownership or unread state are rewritten. |

## Validation

Regression checks execute the actual endpoint and React components using the
retained seven-selected-application/four-paid-out-receipt shape. Schema validation
rejects proposed_rate, paid_at and the old review fields even on empty tables.
They exercise query failures, caller ownership, account changes, zero net,
cancelled estimates, stale Stripe readiness and legacy category filtering.
PostgreSQL/PGlite executes the actual expiry migration and authoritative
application RPC to verify quota rollback, retryable invitations, UK dates,
historical updates, idempotent replay and private trigger permissions.

## Rollout after merge

1. Apply `20261121202706_guard_application_expiry.sql` to the intended production
   database. It adds only the expiry trigger/function and does not rewrite data
   or replace the established application RPC, eligibility, quota or notification
   logic. The installed authoritative RPC and `app.jobs.start_date` must exist.
2. Deploy `apply-to-job` and `get-guard-job-history`. Preserve their current
   authentication configuration and ship history's relative dependencies:
   `lib/guard-application-status.ts` and
   `lib/payments/guardPaymentDisplay.ts`. The source uses the same repository
   relative import pattern as the existing client-history endpoint.
3. Pull the merged frontend into the existing Readdy project and publish it.
4. Recheck only G01–G05 with the labelled QA guard. Seven selected applications
   should remain visible and four retained paid_out receipts should reconcile to
   £250 net in that fixture. Expired active discovery should be empty; historical
   details remain accessible. Payment alerts should appear under Payment, and a
   failed Stripe status check must show unavailable rather than Ready.

Do not relink the retained sandbox payout account to hide a live-mode mismatch,
change billing/prices, post a new job, accept real legal terms, send a support
ticket or message, or move money for this smoke. The QA account remains disabled
outside an explicitly authorised bounded test and must be restored afterward.
No live deployment or post-release acceptance is claimed by code validation alone.
