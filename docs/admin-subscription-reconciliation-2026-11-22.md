# Admin subscription reconciliation — 22 November 2026

## Basic sandbox renewal

Martin chose **Keep sandbox fixture and reconcile renewal**. Stripe read-only retrieval from QuickGuard sandbox account `acct_1SYmuoIMkpwfAEDT` independently confirmed:

| Evidence | Value |
| --- | --- |
| Local subscription | `58ea2b87-c8e7-484b-a97e-e8d0eccfdaae` |
| Synthetic user | `8ec6113d-7b78-4c69-a90c-86d0e4b69714` |
| Stripe subscription | `sub_1UNGf0IMkpwfAEDTfSohHVse` |
| Sandbox customer | `cus_VO2jzA0T87Gutg` |
| Existing price | `price_1TcvjKIMkpwfAEDTR040YjkP` |
| Paid renewal invoice | `in_1UYVRqIMkpwfAEDTE5wg03Vk` |
| Amount | GBP 10, non-live |
| Service period | 5 November–5 December 2026, 18:30:50 UTC |
| Paid timestamp | 5 November 2026, 19:32:17 UTC |

The invoice root period describes the preceding accrual window; the recurring line has the November–December service period. The repair uses the actual service period and payment timestamp. PaymentIntent/charge references were not returned in this invoice read and were left null rather than fabricated.

`scripts/ops/20261122-reconcile-basic-sandbox-renewal.sql` was tested against PostgreSQL before being applied. It locks the fixture, checks exact ownership, test identity, existing Stripe IDs and period, refuses conflicting invoice data, records the new invoice once, and updates the subscription period. The existing trigger updates the canonical entitlement. Protected guard data and entitlement features must remain unchanged or the whole statement rolls back. An idempotent admin audit records Martin's decision, provider evidence and previous values. It does not mark any webhook event processed.

Production readback confirmed one new invoice, one original October invoice and one reconciliation audit. Subscription and entitlement now end **5 December**. Guard eligibility, plan and separate live profile customer `cus_VcfannyExX18cO` were preserved. No Stripe write, charge, refund, webhook replay, outgoing email or booking action was performed.

This corrects the existing synthetic fixture. It does not resolve the separate routing/environment gap: sandbox invoice/subscription endpoints still need a deliberate isolated-test configuration before future UAT renewals. Do not route sandbox events broadly into production or overwrite the profile's live customer ID. Mixed-mode profile mapping remains visible for review.

## Admin invoice backfill repair

The Payments control called a hardcoded endpoint without an admin token and reported success even on HTTP errors. The live backfill endpoint accepted only the service key, skipped a user if any older invoice existed, and ignored write errors. Its root invoice-period fields could record the preceding accrual window rather than the purchased service period.

The frontend now invokes the configured function through the authenticated SDK, checks the entire result and reports partial errors. It blocks overlapping requests and ignores late results after unmount. The invoice check remains available when an older payment already exists, so a new renewal can be discovered. Missing-history counts use subscription IDs rather than user IDs.

The backend preserves trusted service callers and additionally requires a verified active finance/admin role with MFA for admin callers. It validates invoice/customer/subscription/price/mode ownership; checks by invoice ID; uses the existing unique invoice index for race safety; checks insert and summary-update outcomes; and supports a read-only preview and optional subscription scope. It reads Stripe only. Wrong-environment retrievals fail explicitly and never replace billing IDs. It does not modify entitlement periods or guard/customer mappings. The approved one-off fixture correction above is separate.

Invoice ledger service periods are taken only from complete, unambiguous, non-prorated matching subscription lines. Missing/ambiguous periods remain unknown, rather than borrowing unrelated root dates. Provider paid timestamps are used where available. Failed writes cannot report success; retries do not create a duplicate invoice.

## Elite complimentary access: exact HAL handoff

Paste the following task into the existing HAL Codex session:

---

Repair only the complimentary-grant interpretation in QuickGuard Subscription workflow `pGoacDSUO4i4dNMN`. Export and back up the current workflow; preserve credentials, schedule, activation, IDs, wiring and unrelated checks.

The existing `app.plan_change_history` row **id 1**, created **18 November 2026 at 10:14:01.405935 UTC**, records Martin's deliberate complimentary pre-launch grant for user `5c09b95c-20e3-4be4-bfe9-d4506da476f0`. It has `changed_by=admin`, `change_source=manual_launch_test`, `account_type=guard`, `new_plan_slug=guard-elite`, `metadata.complimentary=true`, `metadata.applied_guard_equivalent=guard-elite`, `metadata.stripe_subscription_created=false`, and `metadata.previous_subscription.id=676905df-1efb-4c27-ad17-453cb82d3581`. The reason explicitly says Martin requested the highest guard plan for pre-launch testing.

Read the plan history through a service-authorised, fail-closed query. Production RLS is enabled; browser roles have no permissive INSERT/UPDATE policy. Inspect current policies before trusting the audit as provenance. Use the latest relevant history for each user/account type, and require the exact current subscription, current plan and active status to match. A valid complimentary case must also have plan_amount=0, auto_renew=false and no Stripe subscription/customer/price references. Do not accept a user-editable flag, a test email, a zero amount or a test-account flag alone as proof. This guard's is_test_account is currently false; do not change it or its eligibility.

Classify this proven non-billed grant separately from paid subscriptions missing Stripe evidence. Retain an informational audit finding with the history/subscription IDs and reason. Do not invent an expiry or Stripe ID, mark a payment succeeded, or hide real billing failures. Missing/malformed history reads must leave the missing-billing finding visible. Superseded, revoked, mismatched or positive-price grants must not exempt a subscription.

Add isolated fixtures for this exact valid grant, a normal paid plan without Stripe evidence, untrusted/absent evidence, wrong user/plan/subscription, a newer superseding change and failed history reads. No billing or entitlement writes, emails or webhook replays. Verify one normal scheduled snapshot: the Elite P1 should be replaced by the grant information; genuine subscription warnings remain.

Basic's controlled sandbox renewal has separately been reconciled in QuickGuard and now ends 5 December 2026. Verify that its stale-period P1 clears on the next read; preserve the separate live/sandbox customer mapping warning. Return workflow/version IDs, tests, scheduled execution/snapshot IDs, remaining findings and rollback locations.

## Observed follow-up and validation

The **19:37:04 UTC** scheduled Subscription snapshot confirms that the Basic stale-period P1 has cleared. Critical incidents fell from two to one; the remaining P1 is the Elite complimentary-grant interpretation described above. Nineteen other warnings remain and were not suppressed.

Validation includes PostgreSQL-backed repeat/identity/collision/audit-rollback tests for the approved fixture SQL, handler tests for admin/MFA/service authorization, existing-payment renewal discovery, replay, dry run, foreign references, invoice conflicts, failed reads/writes, modern invoice line periods and unknown periods; frontend tests cover rejected/malformed/partial results, missing sessions, overlapping requests and unmount races. All Stripe calls in automated tests are mocked reads; the actual provider evidence was independently fetched read-only.

The repository/admin TypeScript checks, focused lint and strict Edge compilation against Supabase JS 2.39.3 and Stripe 14.10.0 passed. The production frontend build passed with 214 pages. The full regression suite passed 1,049 tests; final invoice-conflict guards were also exercised before publishing. The frontend requires merge and Readdy publication for a live admin-button retest; no live backfill scan was invoked during this repair.
