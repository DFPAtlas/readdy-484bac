# New guard and client registration notifications

New `app.guards` and `app.clients` profile inserts queue an admin email to `martin.s.hewett@outlook.com`. Both email signup and social signup persist profiles in these tables. This is a registration notification, not a claim that onboarding or SIA verification is complete. Updates and normal sign-ins do not send another notification. There is no historical backfill.

The email contains name, email address, account type, creation time in UK local time and a link to the existing account detail modal. Guards also show the SIA verified flag at registration. Applicant-controlled HTML is escaped; documents, bank details and identity documents are not copied into emails. The existing sender is `QuickGuard Notifications <notifications@quickguard.uk>`.

The link contains only the role and profile UUID. Admin authorization and MFA remain enforced by the existing admin layout and database policies. A narrowly validated return destination is stored in session storage across login/MFA and consumed on successful entry. Missing/inaccessible records show a message rather than opening another applicant.

## Reliability

Queue insertion and profile creation are one database transaction. A rolled-back registration sends nothing. Resend calls happen asynchronously, so a provider outage does not hold up registration. A database queue-write failure rolls back the profile insert rather than silently losing the notification.

A scoped unique index deduplicates by account type and user ID while the queue record is retained. The current queue key trigger derives that key from server-set `source_record_id`. Retried provider requests use a stable Resend idempotency key based on the queue UUID. Resend retains idempotency keys for 24 hours; do not blindly replay an ambiguously accepted message after that window. Reconcile provider logs first. Provider acceptance requires a response message ID; acceptance does not establish inbox delivery.

## Deployment and verification

This PR does not apply changes to production or send a live test email.

1. Review the current `app.email_queue` schema/constraints and existing worker scheduler against the migration. Base schema is not fully represented in this repository; local regression tests use an explicit compatible schema.
2. Deploy the updated `process-email-queue` worker, then apply `20261101110812_admin_registration_notifications.sql`. Publish the frontend from the same commit.
3. Confirm the verified Resend sender, worker secret/API key and worker scheduler are functioning.
4. Register one new guard and one new client; confirm exactly one queue row and provider message per account. Check actual receipt in the configured Outlook inbox.
5. Open each review link while signed out, complete login and MFA, and confirm the correct detail modal opens. Verify a non-admin cannot view the record.
6. Repeat registration/login and update profiles: confirm no duplicate notification. Check email and social profile creation routes.
7. Inspect failed queue rows and email send logs. Confirm a transient provider failure retries, without marking it sent before provider acceptance.

To stop new notifications, drop `trg_admin_registration_email` on both `app.guards` and `app.clients`. Review pending `admin_registration` queue entries separately before stopping or resuming the worker; do not disrupt other email types.

## Local checks

- TypeScript check.
- ESLint on changed frontend files (no errors; existing warnings remain).
- PGlite database tests: both account types, real queue key trigger, HTML escaping, updates/reinsertion dedupe, rollback, trigger function privileges and no backfill.
- Return-path validation and consumption tests.
- Mocked email-worker tests: provider acceptance, stable idempotency key, retry path and unauthorized requests.
- Production build and full regression results are recorded in the PR description.
