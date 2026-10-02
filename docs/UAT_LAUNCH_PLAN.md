# QuickGuard public-launch UAT plan

Target: public launch and advertising by 30 November 2026.

## Controlled personas

The suite creates three clients and four guards. Every user is marked with `uat_run_id=launch-2026-11` in Supabase Auth metadata and can be removed with the guarded cleanup command.

| Persona | State | Purpose |
|---|---|---|
| client-free | Active free client | Job posting, plan limits, selection and payment |
| client-pro | Active pro client | Paid entitlements and higher-volume journeys |
| client-cancelled | Cancelled free client | Cancellation, access and recovery behaviour |
| guard-door | Verified door supervisor | Eligible application, selection and completion |
| guard-cctv | Verified CCTV licence | Wrong-licence rejection and CCTV eligibility |
| guard-pending | Pending SIA check | Must not apply or accept work |
| guard-expired | Expired and suspended | Must not access guarded work journeys |

All email aliases resolve to one protected inbox supplied through `QG_UAT_INBOX`; no personal address is committed to GitHub.

## Release gates

A public launch remains NO-GO until every critical item has captured evidence:

1. Client and guard registration, login, reset and logout.
2. Profile completion, private document isolation and SIA-state gating.
3. Client creates draft, publishes job and reaches the correct plan limit.
4. Only eligible guards can apply; duplicate, pending, expired and wrong-licence applications are blocked.
5. Client compares applicants, selects a guard and reaches payment without funding before selection.
6. Stripe sandbox payment, failed payment, duplicate webhook and subscription cancel/resume paths reconcile to Supabase.
7. Completion approval, cancellation, refund, dispute and sandbox payout states reconcile once only.
8. Every expected transactional email produces a provider ID and a successful delivery event; bounce and complaint cases are handled.
9. Cross-account RLS tests prove clients and guards cannot access another account's private records or documents.
10. Mobile, accessibility, browser smoke, monitoring, backup/restore and support-response drills pass.

## Required protected settings

- `QG_UAT_SUPABASE_URL`
- `QG_UAT_SUPABASE_SERVICE_ROLE_KEY`
- `QG_UAT_INBOX`
- `QG_UAT_SHARED_PASSWORD` (temporary, at least 16 characters)

## Safe operation

- Stripe must remain in the QuickGuard sandbox for UAT.
- Do not use real SIA numbers, real shifts, real customers or live payouts.
- UAT job titles must begin with `[UAT launch-2026-11]`.
- Cleanup requires `QG_UAT_CONFIRM_CLEANUP=launch-2026-11` and deletes only Auth users carrying that exact metadata tag.
- Keep the evidence artifact from the final passing run with the signed launch decision.

