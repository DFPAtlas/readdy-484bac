# Client smoke-test repairs: Job History and assigned guard profiles

This PR addresses C02 and C03 from the 19 November client smoke test. It is
independent of the payment-document repair in PR #175.

## Confirmed causes

- `get-client-job-history` defaulted to the public schema and selected
  `clients.total_spent`, which exists only in `app.clients`. It discarded that
  query's error and returned an apparently empty client account.
- Other history queries also requested nonexistent job refund/cancellation
  columns, nonexistent review names, and the wrong transaction intent column.
  Some errors were discarded, especially in guard searches and related records.
- The assigned UAT guard is inactive. The existing applicant profile view only
  includes active, approved applicants, and some assignments have no application.
  It is unsuitable for identifying every historical assignment.
- Read-only checks of the corrected application-schema job query find all nine
  owned, non-deleted jobs and eight assigned profiles, all inactive. All eight
  profiles have a recorded licence. No account or database records were changed.

## Changes

History explicitly selects `app`, authenticates the caller, rejects closed
accounts, checks client/job ownership and propagates every failed read. It uses
the actual column names and maps review/transaction aliases to the existing UI
contract. Recorded refunds come from transactions. Guard search results are
ordered before pagination. Legacy null deletion flags are treated as not deleted.
The frontend rejects incomplete responses and never combines a failed load with
the claim that the client has not posted jobs.

The new `get-client-assigned-guards` function authenticates the caller, rejects
closed accounts, derives the client from the verified user, proves job ownership,
then derives guard IDs from that job's assignments. Caller-supplied client/guard
IDs cannot broaden the response. Its response is a fixed projection of the
existing client-visible profile fields, plus inactive status. Private licence
documents, phone, address, email and financial details remain excluded. No guard
table permissions, applicant visibility rules or RLS policies change.

The shared assignment loader now uses that function, preserving the display
aliases expected by job details, the drawer and the payment page. Missing or failed
profiles produce explicit errors. Job details offers retry rather than computing
false missing-licence warnings from an empty profile. Inactive profiles are labelled
on the assigned guard card. Redacted private document URLs do not imply that the
documents were never uploaded.

## Validation

Tests use synthetic records and a column-only snapshot of the inspected schema.
They execute both Edge Function handlers with a mocked Supabase client, checking
owned/foreign/deleted jobs, inactive and unassigned guards, clients without jobs,
failed queries, filters, pagination, review/payment aliases, account closure,
sign-out and response field restrictions. Existing stale-request lifecycle tests
remain in force. Private document redaction is covered separately.

## Release and signed-in acceptance

1. Review and merge this PR. Deploy **both** `get-client-job-history` and
   `get-client-assigned-guards` before publishing the frontend. Both validate
   bearer tokens through `auth.getUser()` internally; their committed config sets
   `verify_jwt = false`, matching that authentication model.
2. Check that anonymous/invalid-token calls return 401. With the client test
   account, verify a foreign job cannot return profiles. No database migration is
   required.
3. Pull the merged code into Readdy, publish and hard-refresh.
4. Open Job History. Expect nine owned, non-deleted jobs for the current fixture.
   Compare IDs with My Jobs; check search, status/payment/date/guard filters and
   pagination. A genuine zero-result filter should remain distinct from an error.
5. Open an assigned job, its guard card, drawer and payment page. Confirm the guard
   name and recorded SIA/profile facts appear despite the inactive account or a
   missing application. Confirm no private document links or bank details appear.
6. Simulate a failed profile/history request. Expect an explicit error and retry,
   not an empty account or new missing-licence conclusions.

These changes are not deployed by this PR. A signed-in browser retest of the new
release remains required. Financial summary reconciliation (C07), lifecycle stages
(C06), replacement status and other smoke-test findings remain open. History
summary totals retain their existing page-based behavior pending that repair;
this PR does not certify those totals. Public launch remains on hold.
