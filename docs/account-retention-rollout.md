# QuickGuard account closure and retention

This adds a closure event, access shutdown, fixed retention dates and a nightly
worker. It does not backdate existing accounts or delete unmatched legacy files.

## Policy scope

The defaults follow the current privacy policy: account profile minimisation two
calendar years after closure, verification document deletion three years after
closure. Financial/booking records remain separate. Seven years after closure,
the admin retention screen flags them for a documented erasure review; the worker
does not automatically delete financial evidence or claim complete anonymisation.
These periods are business policy defaults, not a legal determination of necessity.
Earlier erasure requests still require review through the privacy-request process.
Support tickets, messages, third-party data, Stripe records and backups are not
purged by the profile/document job. They require their own retention controls.

Closure requires completed/cancelled bookings, resolved disputes/payouts and fully
ended paid subscriptions. Stripe is checked directly, including untracked
subscriptions attached to known customer IDs and outstanding invoices. A scheduled
end-of-period cancellation is insufficient while the subscription is active.
Dual-role and administrator accounts require separate review. Access is blocked
by inactive profiles/entitlements, an Auth ban, restrictive app/public/storage RLS,
and a Data API pre-request gate. Closing records are retried after an Auth failure.

The nightly worker uses a generated Vault token, service-only RPCs, claim leases,
Storage API deletion, and retry/audit events. Legal holds pause cleanup; they can
be added/released only by active super-admins with MFA through the admin endpoint.
The worker rechecks holds before destructive batches and before finalisation.
An already completed deletion cannot be undone by adding a later hold.

## Deployment

1. Apply `20261013051710_account_closure_retention.sql` to the verified QuickGuard
   Supabase project. It refuses to replace an unrelated Data API pre-request hook.
2. Deploy `account-closure/index.ts` and `process-account-retention/index.ts`;
   include the latter's dependency `admin-delete-user/storage-cleanup.ts`.
   Both use custom verified authentication and `verify_jwt=false`.
3. Verify service-only grants, restrictive policies, the pre-request configuration,
   and the `process-account-retention` cron job (`20 3 * * *`, UTC).
4. Verify unauthenticated callers are rejected. Perform synthetic SQL/handler tests;
   do not close a real account merely to test the schedule.
5. Merge the PR, then make one Readdy pull and publish for the user/admin controls.

No new secrets need to be supplied: the scheduler token is generated in Vault.
The account-closure function uses the existing `STRIPE_SECRET_KEY` for read-only
billing verification. Failure to verify billing blocks closure.

## Verification

The SQL tests exercise idempotency, fixed dates, active-billing/booking blockers,
RLS rejection of stale tokens, protected owner grants, legal holds, leases/retries,
profile minimisation, verification clearing and financial-review staging. Handler
tests exercise ownership/MFA, Stripe and invoice blockers, Auth shutdown failures,
worker authentication, storage failure, incomplete deletion and metadata clearing.
The existing deletion tests cover nested/paginated Storage API cleanup.

## Rollback

Suspend the `process-account-retention` cron job first. Keep closure rows and audit
history: a closed account must not silently reopen. Restore prior frontend code if
necessary. Removing access blocks or Auth bans requires a separate account review.
Do not drop the closure registry while restrictive policies/pre-request functions
refer to it. If an empty-registry migration is rolled back, remove only this
migration's policies, triggers and pre-request setting; reload PostgREST config.
Future schema migrations creating exposed tables must include the closed-account
restriction. The pre-request gate continues to cover Data API requests globally.
