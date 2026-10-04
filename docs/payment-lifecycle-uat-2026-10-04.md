# Payment lifecycle verification — 4 October 2026

Status: backend fixes deployed; transfer, duplicate retry and reversal verified. Hosted Express onboarding and the listed UI checks remain incomplete. All new financial fixtures used Stripe sandbox, not live funds.

| Check | Evidence / result |
| --- | --- |
| Subscription renewal | Real test-clock invoices paid; subscription and entitlement active. |
| Failed renewal | Invoice in_1UMu1nIMkpwfAEDTMpEY4KSU failed; subscription past_due, failure count 1, entitlement inactive. |
| Recovery | Paying the same invoice restored active entitlement and reset failure count; one ledger row updated to succeeded, not duplicated. |
| Scheduled cancellation and resume | Cancellation flag set while access remained active; resume cleared it. |
| Cancellation at period end | Clock advance cancelled subscription and revoked entitlement; no extra renewal invoice. |
| Stripe charge dispute | Native created event evt_1UMuA0IMkpwfAEDT5bZHHtj7 completed; funded job held with audit record. Genuine updated/closed events were signed and replayed directly, both HTTP 200; current dispute state fetched rather than trusting delayed snapshots. |
| Client dispute | Genuine client session: mismatched assignment rejected, valid case created, repeat returned same case; one case/audit and funded status preserved. |
| Guard completion and client approval | Genuine guard/client sessions completed request and approval for job a26f86b4-e8a5-4a3e-907e-3a2d1facbd25. Payout remained pending with setup-required audit because connected account was not onboarded. |
| Guard transfer/retry | Actual QuickGuard handler submitted £80 to API-created Custom sandbox recipient acct_1UMvjsIl6yJPXXdQ, transfer tr_3UMuNlIMkpwfAEDT1zhM9H4Z. Retry returned the same ID; one Stripe transfer and one application payout record. Native webhook marked assignment/job paid_out. |
| Full reversal | Genuine £80 reversal trr_1UMvlqIMkpwfAEDTRsF0NZ4N; native webhook restored funded/payout_approved job, payout_pending assignment and failed payout. A follow-up retry exposed cached stale success; fixed to fetch current Stripe transfer before returning a replay. Deployed retry returns HTTP 409 and finance-review message. |
| Automated regression suite | 82 passed, 0 failed, 0 skipped. |
| Production build | Passed; existing Next configuration skips type validation. Full typecheck still fails on existing frontend errors. |

## Confirmed failures repaired

- Modern Stripe invoices resolve subscription through parent.subscription_details.
- Failed invoice handling reconciles current Stripe state; it no longer fabricates cancellation after three failures or overwrites a paid invoice with a delayed failure.
- Financial writes are checked before completing webhook processing. Invoice ledger uniqueness is enforced.
- Stripe dispute event subscriptions and handlers were added; disputed charges block guard transfers while funded job invariants remain valid.
- Client dispute and completion decisions use service-only atomic database operations, validate assignment ownership, and preserve independent finance holds.
- Guard completion no longer applies the caller JWT to service database reads. Approval no longer calls .catch on a PostgREST thenable; payout failure audit supplies the required status.
- Admin cancellation/resume validates local subscription ownership and checks persistence failures.

## Deployed state

Supabase project vnywjfpkepjgclkbcmsj: enhanced-stripe-webhook v112, create-guard-payout v46, dispute-job v18, request-job-completion v25, approve-job-completion v32, cancel-subscription v34, resume-subscription v32.

Migration 20261004182919_atomic_payment_disputes.sql reflects the SQL applied during verification. Its new RPCs are SECURITY INVOKER, executable by service_role only; authenticated access was checked and denied. SQL was applied directly during iteration, so this file has not been recorded in remote migration history. Reconcile history before future migration deployment.

Stripe endpoint we_1Tcnw2IMkpwfAEDTZeM6EHvQ now includes charge.dispute.created, updated and closed.

## Remaining work

1. Complete hosted Express sandbox onboarding for acct_1UMu2QEpqceXK9v5. Its form fails after the user-completed robot check with “Invalid string: P1_e...Gvxg; must be at most 5000 characters.” Fresh links did not resolve it. Root cause is not confirmed. Transfer testing used a separate documented API-created Custom test account, so it does not validate the Express onboarding UI. Only the isolated guard fixture was remapped. Bank payout completion has not been verified.
2. Exercise cancellation/resume through a genuine finance administrator session and the client billing portal UI. Lifecycle webhook behavior and handler regression tests passed, but those UI paths are not end-to-end verified.
3. Resolve existing frontend typecheck failures before claiming project-wide validation is green.

The main user's active subscription was left unchanged. The temporary privileged UAT runner is disabled before handoff; fixture IDs are retained for follow-up verification. An older superseded payout fixture is explicitly held to prevent accidental release.
