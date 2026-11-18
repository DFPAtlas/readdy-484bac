# QuickGuard consistency repairs

This branch addresses the 17 findings in the 17 November 2026 whole-site consistency audit. Frontend changes require merge, Readdy import and publication before appearing on quickguard.uk.

| Finding | Repair in this branch |
| --- | --- |
| QG-01 Cancellation/refunds | Shared review-based guidance replaces conflicting automatic refund bands and timings. Confirmation/help/refund screens use the same explanation. Cancellation modal accepts funded and confirmed jobs as well as the other supported states; database ownership, status and financial checks remain authoritative. |
| QG-02 City metrics | Removed fixed guard/client/job counts and response-time averages from nine city pages. Also removed directory guard counts and unsupported rating, immediate deployment and SIA approval claims. Availability is qualified. |
| QG-03 Testimonials | Removed 27 city testimonials and four use-case testimonials lacking established provenance. |
| QG-04 Missing promotion configuration | Migration restores the missing app singleton from the existing public record under a table lock, without overwriting app administration changes. New read-only RPC exposes aggregate recognition availability only. Tests match the live app table's lack of a unique constraint. |
| QG-05 Rewards | Public, account, referral share and popup copy explicitly describes redemption as planned and unavailable at checkout. Recorded balances and existing accrual are preserved. This branch does not implement redemption. |
| QG-06 Company portal | Sidebar destinations use existing dashboard tabs. Unfinished setup/settings actions are labelled support requests. Public security-company onboarding is explicitly the client journey; the management portal remains administrator-issued. This does not implement company CRUD or change hosting's unknown-route HTTP status. |
| QG-07 Upgrade recommendations | Recommendation uses the configured catalogue and current entitlement. Starter history/tracker, Basic boost and free guard alerts are described consistently. Owning a feature no longer triggers an upgrade claim. |
| QG-08 Founding benefits | Recognition is distinguished from subscriptions. Removed unsupported 12/6/3-month paid-membership waivers. Guard booking commission is zero for all guards. |
| QG-09 Legacy window | Existing May launch date and caps are preserved. The expired August window is displayed as closed. Dormant client offer says service-fee waiver, with guard pay still due. No new legacy launch date is invented. |
| QG-10 Metadata | Corrected approval timing, prepaid booking, payout checks, mobile design preview and tax/reporting descriptions. Free guard account is included in homepage structured data. |
| QG-11 Marketing claims | Removed unsupported volume and 3x claims in guides, registration, profile nudges and profile wizard. Inspected live portal signup settings; no override records were present. |
| QG-12 Feature descriptions | Removed self-service API-key/IP/webhook, automatic right-to-work, weekly report and featured-placement promises from upgrade benefits; integration requires scope confirmation and boost placement is planned. Other company modules remain limited to their existing views. |
| QG-13 Overruns | Pricing/event guidance describes agreement and support review rather than an unimplemented automatic top-up request. |
| QG-14 Insurance | Separates licence information from checking cover required for the booking. No attribution of public liability insurance requirements to the SIA. |
| QG-15 Browser storage | Corrected implemented key names, added draft/referral/popup/admin/analytics groups and explained selected values sent for requested services. Consent-before-analytics controls are unchanged. |
| QG-16 Support hours | Footer and contact page use shared Mon–Fri 9AM–6PM human support hours, with AI support available 24/7. |
| QG-17 Admin fee estimate | Removed fixed 10% plus separate Stripe surcharge estimate. Test guard-pay entry is labelled clearly and the server checkout/recorded payment supplies actual fees. |

Additional printable-pricing corrections remove an unsupported 30-day unconditional refund guarantee and fixed 20% annual discount claim, and replace the placeholder footer logo text.

## Database deployment

`20261118000420_reconcile_guard_promotion_configuration.sql` was applied to QuickGuard Supabase project `vnywjfpkepjgclkbcmsj`. Confirmed one app configuration row, the original public/app launch dates match, and anonymous summary reports the legacy window closed. No allocation was invoked on live guard accounts. Existing guard, payment, reward and subscription records were not rewritten.

The public RPC intentionally returns configured caps, remaining counts, pause status and the legacy window, without personal data, fee internals or write access. Post-migration security advisories match the pre-existing baseline.

## Validation

- Catalogue and navigation regression tests, plus PostgreSQL promotion migration/RPC tests including no-unique-constraint schema, reapplication, preservation of admin edits, anonymous read access and denied table access.
- Complete unit suite: 369 passed, zero failures (executed serially to constrain database-test memory use).
- TypeScript, ESLint and production build.
- Source link scan across 836 source files and 180 route files: 872 literal internal links, no missing route or public-file destinations. Generated company tab URLs are covered separately.

These checks do not establish live payment UAT, rewards redemption, completed company management workflows or legal approval of a new cancellation policy. Payment/refund execution, December checkout offer scheduling and secrets are unchanged. The December Pro offer retains its 1 December 2026 start.
