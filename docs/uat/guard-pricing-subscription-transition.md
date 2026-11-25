# Guard pricing and subscription transition — phase 2

Prepared 25 November 2026. Stacked on phase 1, PR 277, commit `89242cee5f2ff41702d0bb91d48ec54fce01d9fc`. This is a draft implementation and isolated sandbox validation, not production deployment or launch sign-off.

## Commercial model

Guard profiles, browsing and job applications are free, without paid application caps, job tiers or placement. Approval, active-account, licence, job requirements and other eligibility checks still apply. New paid guard memberships and resuming their renewal are blocked by authenticated server handlers, including stale links and legacy plan aliases. Existing subscriptions, invoices, entitlements, payment references and token history are retained.

The owner confirmed that QuickGuard is **not VAT registered** on 25 November. Published QuickGuard subscription and booking-service fees are final amounts with no VAT added. Do not describe these as VAT-inclusive or issue a VAT invoice. Tax treatment of separately supplied guard services and any employment/payroll obligations requires the engagement model to be settled.

| Client tier | Monthly subscription | Posts/month | Booking service fee | Fee on £120 gross | Client booking total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Free Starter | £0 | 1 | 15% | £18 | £138 |
| Starter | £49 | 10 | 10% | £12 | £132 |
| Pro | £99 | 30 | 7.5% | £9 | £129 |
| Enterprise | £199 | Unlimited | 5% | £6 | £126 |

Subscriptions are additional to booking totals. Standard payment processing is covered within these client charges; there is no promise of unlimited processing. Examples use one guard for eight hours at £15/hour, exclude promotions and statutory payroll adjustments/employer costs, and preserve £120 agreed **gross**, not take-home pay. No new-booking platform or Stripe deduction is charged to the guard. Existing production client prices and fee rules already match this model and were not changed. Existing annual test prices (£490/£990/£1,990) were verified, not recreated.

## Implementation

- Shared pricing and printable pricing show the four client tiers, actual fee calculations, a free guard account and the confirmed tax wording. Fee-read failures remain explicit and disable printing rather than showing zero fees. Registration, launch material, guard guides, homepage structured data, help, rewards guidance and relevant terms no longer advertise paid guard job access.
- Upgrade routes handle a signed-in guard, old guard reasons and preselected guard plans without Subscribe or new token-redemption controls. An owned pending historical token checkout can still be cancelled to reconcile its reservation.
- `create-subscription-checkout` and `create-wizard-checkout` reject new guard purchases before provider/token mutation. `resume-subscription` rejects guard records and unclassified scope, requires an active client for client renewal, and checks the local provider binding.
- Self-service cancel/resume previously called administrator-only handlers. Verified owners may now manage their own bound subscription. Other-account actions still require an active super/finance administrator; foreign bindings are rejected before Stripe mutation. Guard cancellation remains possible, guard resumption does not. These are handler fixtures and code changes: no actual subscription was cancelled/resumed and no notice was sent during this work.
- Guard dashboards/admin records retain historical plan names and financial information. Guard tracking counts are informational, with no old-cap progress/over-limit state. Existing reward balances and redemptions are retained for a separate credit review; no new guard-membership redemption is offered.
- Migration `20261125182810_retire_paid_guard_memberships.sql` deactivates paid guard catalogue rows and makes the free guard allowance uncapped. It does not rewrite paid names/prices/provider IDs/features, cancel subscriptions or modify entitlements/rewards. It fails before mutation if the free-plan slug has a conflicting audience/price. No tables, grants or RPC privileges are added.

## Read-only subscription reconciliation

The production database was inspected read-only. Aggregate current guard records: four active free Starter rows (two test accounts), one active Basic row with a provider binding (a test account), and one active Elite manual entitlement without a provider binding. Database status alone is not proof of a paid live subscription.

Both connected Stripe modes were checked explicitly: the live account returned **zero subscriptions**, with pagination exhausted; the test account returned six, with pagination exhausted. The one renewing database provider reference matches an active **test-mode** subscription whose period ends **5 December 2026 at 18:30:50 UTC**. Its renewal flag is still on. This is a mode-reconciliation issue, not evidence of a live customer charge. No customer/subscription identifiers are included here. No provider object, price, subscription, refund or notification was changed.

Before rollout, recheck both modes and any other billing account, confirm ownership of each actual paying record, resolve test references in production through a separately scoped correction, and review the notice/cancellation/credit treatment. Do not silently rewrite financial history or cancel a provider object based solely on a local plan label. Archiving a price does not cancel existing subscriptions, and end-of-period cancellation/refunds are separate decisions.

## Sandbox evidence

Only `qg-e2e-sandbox` (`alfwwggavmyerjyqumuo`) was changed. Production was not deployed to or written to. Cron remains disabled; retained fixtures remain closed. No provider payments or deliveries were exercised.

The sandbox originally had only Starter and historical Elite catalogue rows and one fee rule. `scripts/uat/guard-pricing-test-catalogue.sql` seeds the missing client tiers/fees using verified **existing test-mode** price/product bindings and public production service features, with closed-fixture/cron guards. It creates no Stripe objects and copies no live provider IDs. The phase-2 migration then closes paid guard sales.

| Sandbox handler | Original version | Validated version | JWT requirement |
| --- | ---: | ---: | --- |
| create-subscription-checkout | 105 | 106 | Existing false; handler verifies the user itself |
| create-wizard-checkout | 96 | 97 | true |
| resume-subscription | 52 | 54 | true |
| cancel-subscription | 54 | 55 | true |

Original sources/dependencies matched the phase-1 base apart from final newlines. Deployment retains the original authentication setting, dependencies and pinned Stripe version/API. No unrelated billing SDK upgrade was introduced.

- Full local regression: **1,318 passed, zero failures/skips**. Includes actual handler fixtures for guard rejection, client checkout/navigation, own/foreign billing management and payment freeze; actual UI rendering; idempotent PostgreSQL catalogue changes preserving historical financial data; and the previously unscheduled Christmas experiment suite. The production Christmas offer now admits Client Pro only, preserving its existing date boundaries.
- Repository and admin/financial TypeScript checks passed. Next production build uses loopback placeholder Supabase settings. Lint has zero errors and twelve pre-existing warnings; exact-head CI repeats these checks.
- `scripts/uat/guard-pricing-native-smoke.sql` passed using the anonymous role: free uncapped guard configuration, no active paid guard tier, all four active client prices/posting allowances/fee rules and the four £120 booking totals.
- Captured sandbox catalogue restore was rehearsed **inside a rollback-only transaction**, restoring the original two plans and one fee rule before rolling back the rehearsal. Current catalogue remains in the retired-guard state. This is not a complete deploy/rollback drill.
- Before/after row digests match: subscriptions `0fa2d0b9c56a05b44185f63da5e5fe7c`, entitlements `f600d0d2cf5ea97c024ace574de3f0fb`, jobs `0f943ad24428985b986e79ea0c6608e4`, token ledger `80ec0bf3c37a88412c58ed57e8654b35`. Active cron jobs: zero.
- Local Chromium is unavailable because this execution environment blocks its socket. Exact-head PR CI runs `guard-pricing-browser-smoke.cjs` on built pages at 1440px and 390px using synthetic APIs, blocking provider traffic. It covers public monthly/annual pricing, fee failure/recovery and disabled printing, free guard pages despite stale paid data, zero provider calls and zero page runtime errors. Review the PR CI link/evidence for its result; do not treat these fixtures as a real-account payment acceptance test.

The existing sandbox Security Advisor findings recorded in phase 1 remain outstanding. This migration adds no privileges/functions; Health Advisor had no findings. No clean security or legal audit is claimed.

## Rollback and release gates

`scripts/uat/guard-pricing-sandbox-rollback.sql` is guarded for the captured closed sandbox only and restores its exact catalogue baseline. It must never run on production. Revert the matching frontend/handlers together, preserving JWT settings. A production fallback must keep paid guard sales and work-access gates closed while fixing forward; do not reopen old paid access as an automatic rollback.

Before any production release:

1. Review the phase-1 dependency and phase-2 draft with exact-head CI/browser evidence. Complete a controlled authenticated sandbox journey through the actual Edge and provider test path, and a complete restore/reapply drill without reopening closed fixtures merely to pass tests.
2. Obtain written review of the UK employment-agency/employment-business, engagement/payroll, payment, tax and privacy model. These code changes alone do not establish compliance. Review invoice/payment snapshots against the agreed gross-pay and client-fee model.
3. Reconcile existing subscriptions again, review legacy credits/rewards and promotion promises, any previously opened checkouts or billing-portal sales paths, and any guard price archival. Agree customer-specific notices/refunds/credits before performing financial actions. Preserve the underlying records.
4. Implement guest Book a Guard: account choice/login, genuine filtered availability, account creation before booking, secure draft recovery and separately consented abandoned-booking leads/retention. This remains the next phase.
5. Complete integrated guard/guest/client/admin/payment/refund/consent failure-and-retry smoke. Record remaining findings, then separately approve production rollout and final live smoke. Neither draft PR is merged by this work.

References: [Stripe price management](https://docs.stripe.com/products-prices/manage-prices), [Stripe subscription cancellation](https://docs.stripe.com/billing/subscriptions/cancel), [GOV.UK VAT records](https://www.gov.uk/charge-reclaim-record-vat/keeping-vat-records).
