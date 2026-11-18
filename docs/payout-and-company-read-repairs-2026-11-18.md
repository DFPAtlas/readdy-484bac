# Guard payout settings and company dashboard reads

## Confirmed problems

The guard bank-settings page requested `payout_frequency`, `minimum_payout`, `hold_payouts` and `instant_payout_enabled` from `app.guards`. Schema inspection confirmed none of those columns exists. A failed profile read was ignored, preventing Stripe account status and payout setup from loading. The same controls were written without checking the update error, so the UI could report a successful save after a failed preference update.

The manual bank-details form wrote a separate legacy table. The inspected deployed payout path uses the guard's Stripe Connect account, not that record. Its remove-account message therefore incorrectly implied removal would stop Stripe payouts. The page also treated a Stripe onboarding return as proof of completion and could display an unavailable account status as not started.

The company dashboard queried the nonexistent `messages.is_read` field; the live field is `read`. Failed reads were converted to empty arrays or a zero unread counter. A profile-read failure could be mistaken for a missing company profile and sign out the user.

## Repairs

- Guard profile reads use only the supported identity columns and explicitly handle read failures. No legacy raw bank-account records are fetched, saved or deleted by this page.
- Existing Stripe setup, continue-onboarding and dashboard endpoints provide the account-management actions. The caller uses the current session and checks it still belongs to the loaded user. Actions require confirmed status and run once at a time.
- Failed or malformed status reads remain unknown with retry. Ready status requires submitted details, enabled transfers and bank payouts, and no outstanding restrictions/requirements. A return query parameter is only a navigation notice.
- Account links must use approved Stripe HTTPS account hosts. Late reads and redirects are ignored after cleanup, newer requests or account changes.
- Removed unsupported payout scheduling/minimum/hold controls and the misleading local bank form. Existing stored records remain untouched. The page explains job release and bank deposit as separate stages and links payout-review requests to support.
- Bank history uses the existing `guard_bank_payouts` tracker, which distinguishes bank deposits from job transfers, masks bank identifiers and formats provider currency amounts.
- Company queries use the correct unread flag. Any failed dashboard source produces a retry state instead of apparently successful empty data. Joined display fields and company/message-owner scopes are preserved; stale results cannot replace a newer dashboard.

## Evidence and validation

Live schema, database routine references, deployed Stripe-status/dashboard/payout function source, and relevant recent database logs were inspected. No preference consumers were identified in the inspected payout code or database routines. No recent matching log entries were returned; that does not establish that the broken page had been exercised.

Sixteen targeted regression cases cover supported schema fields, ownership scopes, status/action failure, URL validation, single-flight actions, retries, account switches, late responses, bank-vs-job history, company read errors and rendered error states. Full-suite, TypeScript, ESLint, admin/financial type-gate and build results are recorded in the PR. Source link scan: 874 literal internal links across 838 source files and 180 route files, no missing destinations.

This change uses existing APIs and requires no database migration or Edge Function deployment. No real Stripe account was created, no bank details were changed, and no payment was initiated during verification. Existing payments, payout execution and the December offer schedule are unchanged. Frontend changes require merge, Readdy import and publication.

Company management CRUD and rewards redemption remain separate development work. This repair makes the existing company read view report its data honestly; it does not complete those modules.

## Merge reconciliation after PR #157

Merged current main, including PR #157 and Readdy v2363. Resolved the company-dashboard conflict by retaining the reviewed read-error handling, correct unread flag and supported navigation. Restored the companion company-navigation helper, sidebar tab links, server Suspense wrapper and existing catalogue/navigation regressions removed by the sync.

PR #157 pricing/dependency repairs and the new blog/launch/navigation/sitemap work remain unchanged from main. This resolution does not restore unrelated audit changes reverted by the Readdy sync. The database and existing Stripe/payment execution paths are unchanged.
