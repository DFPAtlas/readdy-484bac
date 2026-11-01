# QuickGuard launch code review — 1 November 2026

This is an initial review and repair batch, not a certification that every journey is correct. PR 114 has been merged to main at `1275b017a1b5f73af6066eea6a45ee0a3d4a92de`; its migration and worker still require deployment and actual delivery verification.

## Confirmed repairs in this branch

- Full repository lint runs in Build Check before TypeScript/tests/build. CommonJS Node files are configured to allow their native `require()` syntax; the Next.js module-variable rule is disabled only for CommonJS test fixtures that execute compiled modules. Application rules remain enforced. Removed obsolete per-file suppression.
- Converted deprecated `var` declarations in the guard-admin function to scoped declarations using ESLint's safe fixes.
- Guard administration requires a confirmed database update before reporting approval, rejection, suspension, restoration or manual SIA verification. Database errors and zero-row updates return failure.
- Push registration serves a real same-origin `/push-sw.js` instead of an unsupported `blob:` service-worker script. Encryption key material is checked before saving a subscription, and notification-click links are restricted to the same origin.
- Guard registration renders the canonical terms control once, excluding the duplicate dynamic wizard field. Submission carries the canonical consent value.
- Removed hardcoded customer-count/rating figures and certification-like claims from the shared registration panel, and replaced unsupported default guard badges. Administrator-configured copy can still override default badges/subtitle and requires separate content review.

## Validation

- Repository lint: 0 errors. Existing warnings remain; this is not a zero-warning claim.
- TypeScript and admin/financial type gate passed.
- Full regression suite passed: 275 tests. Focused tests cover push encryption material, hosted worker registration, same-origin click destinations, duplicate consent rendering and failed/unconfirmed guard status updates (including restoration).
- Production build result is recorded in the PR description.
- No production code/function deployment, migration, payment, application submission or live email was performed in this batch.

## Published-site smoke observations

Direct cloud-browser inspection confirmed rendering of the homepage, pricing, how-it-works, client/guard login, client/guard registration, privacy, terms, cookie policy and job-browsing page. Both registration forms loaded their dynamic fields, and both login pages exposed email/password, recovery and registration controls. The optional-cookie rejection control dismissed the banner.

The original automated Playwright run could not launch because its browser executable was missing. Browser downloads then failed with an invalid/truncated archive. Those runner failures are not evidence of site failures. The subsequent direct checks are narrower than a completed automated smoke suite.

No mobile viewport or authenticated guard/client/admin workflow has been signed off. Social OAuth, account submission, session expiry, real job creation, payment cutover and email receipt remain unverified in this pass. Rendering a page is not proof of successful submission or backend behavior.

## Live database findings (read-only)

| Finding | Evidence | Release implication |
|---|---|---|
| PostGIS reference-table write access | `public.spatial_ref_sys` has RLS disabled and `anon` has INSERT, UPDATE and DELETE privileges | Hold complete launch sign-off until write grants are reviewed and narrowed while preserving legitimate spatial reads. No write/exploit attempt was made. |
| Five failed emails | All five are `email_system_e2e_test` messages dated 2 October 2026; error text matches domain configuration; retries exhausted | Historical tests, not evidence of a current customer-email backlog. Do not replay without reviewing recipient and provider history. |
| Admin notification dependencies | Queue schema, dedupe trigger and completion RPC verified; nullable queue user reference avoids auth/profile provisioning ordering issue | PR 114 dependency correction tested; deployment and Outlook verification still outstanding. |
| Email worker | Enabled in live mode, scheduled every minute; recent cron submissions succeeded | Scheduling confirmed; cron success does not prove provider acceptance or inbox delivery. |
| Advisor function warnings | Public guard/payment/admin helpers are flagged as SECURITY DEFINER; inspected admin dry-run and payment-summary bodies include authorization checks | Review callers and function bodies before classifying warnings as vulnerabilities; do not blanket-revoke legitimate RPCs. |

Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

## Remaining code-review coverage

The main TypeScript configuration excludes `supabase/functions/**/*`. A passing frontend typecheck must not be described as a complete Deno backend typecheck. Further review must cover backend typing/imports, all privileged mutation paths, error propagation, payment/webhook replay behavior and role boundaries. Existing tests provide useful evidence but do not certify untested journeys.

The remaining 600+ lint warnings are chiefly unused values, image optimization/accessibility advice and text/style diagnostics. They remain visible rather than globally suppressed. Prioritize warnings that affect behavior and accessibility before cosmetic cleanup.
