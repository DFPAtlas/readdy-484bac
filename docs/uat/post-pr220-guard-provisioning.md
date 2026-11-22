# Published admin creation/rejection UAT — 22 November 2026

PR220 merged at 11:48:59 UTC; its current-head Build Check passed. The published form now uses the admin session, requires a submission key and reports pending review.

The live test then exposed backend provisioning faults:

- Auth signup already creates a guard shell. Creation now completes that new user's row through the `user_id` conflict key, preserving its ID and keeping access inactive.
- Application users were missing even though notification preferences reference `app.users`. The service creates the new guard's application user with pending verification.
- Application-user and subscription triggers create entitlements and preferences. Fallback inserts now ignore an existing row, preserving canonical plan features and preference defaults.
- `is_active` and `is_free_tier` on entitlements are generated columns. Their values are left to PostgreSQL.
- PostgREST builders are promise-like and have no `.catch()` method. Optional operations and cleanup now await them inside error handling. Cleanup removes owned child rows before deleting the newly created Auth user, respecting the restrictive subscription FK. The welcome request has a bounded timeout.
- Decision email lookup requested nonexistent guard `first_name`/`last_name` columns. It now uses the canonical full name. Rejection omits the unused dashboard variable, so unconfirmed applicants do not need a generated sign-in token to receive a rejection message. Approval keeps its existing dashboard-link flow.

The controlled account was created successfully through the published UI. It had one application user and one completed creation request. It remained inactive and unverified. A test-only rejection saved the reason and timestamp on the guard, updated the application user and appeared under Rejected after a full reload. The email log recorded the rejection send at **12:37:30 UTC**; an independent Resend lookup confirmed **delivered**. The welcome endpoint returned HTTP 200; welcome-email delivery was not independently established.

An earlier interrupted test account is retained as an inactive, unavailable test-only fixture. Later failed attempts were checked to leave zero Auth/application/guard rows. No real guard eligibility, financial record, attendance or Stripe setting was changed.

Deployment: creation v45, decision email v55; JWT verification retained, source readback matched local code. The admin decision endpoint remains v75. These follow-up changes are backend-only and do not require another Readdy frontend publish.

Validation: **1,008 full-suite tests passed**, including PostgreSQL-backed reproductions of the trigger collisions, generated columns and restrictive FK rollback. The SDK fixture uses real promise-like behavior without `.catch()`. Duplicate retry, preservation of unrelated guards/canonical defaults, email lookup/token behavior and optional notification failures are covered. Repository/admin TypeScript and strict Edge checks passed. An unrelated backup regression fixture was isolated from the Supabase client imported by the newly published compliance panel; its assertions remain intact and pass.

Successful approval UAT, full Auth/uploaded-file recovery and operational record review remain outside full admin sign-off. Live payment/refund testing remains last.
