# Admin endpoint reachability repair — 24 November 2026

System Status previously posted an admin JWT to the retired release route, tried a browser GET against the server-only overdue payout worker, and labelled every HTTP response below 500 Online. This mixed reachability, retirement and successful business operations.

## Observed production evidence

- `release-guard-payment` is absent from deployed function inventory; a read-only GET returned 404. Its archived source and existing UI inventory already identify it as retired.
- `process-overdue-guard-payouts` v18 is active. Its source rejects methods other than POST before processing and requires its existing worker token for execution. A read-only GET returned 405 without browser CORS headers. The deployed source was inspected; it was not changed.
- The existing cron job is active on `7 * * * *`. Its 24 November 09:07 dispatch succeeded. Independent function logs record POST HTTP 200 at 09:07:01.517, taking 1,030 ms. Neither scheduler dispatch nor HTTP 200 establishes that every candidate payout succeeded.
- Supabase health advisors returned no findings. Existing database security/performance notices are separate from this frontend repair.

## Resulting page behavior

- The retired route is labelled Retired with no HTTP/timing claim and is never invoked.
- The overdue worker is labelled Server only, is never invoked by the page, and points to the existing Scheduled Jobs dispatch history. The text explicitly states that worker completion is not verified here.
- Only the other five configured endpoints receive an unauthenticated GET. Credentials are omitted, no body or bearer token is sent, redirects are rejected and each probe has an eight-second limit.
- 401/403 means Protected; 2xx/400/405 means Reachable. These labels do not assert authorised operation success. 404/410, 429 and 5xx get distinct non-success labels. Network, browser-access and timeout failures remain Not verified.
- Refresh clears stale results; cancellation and unmount do not restore a stale ping result. The existing core-service summary is labelled Core Services Healthy rather than claiming all workflows are operational.

## Validation and rollout

Behavioral tests cover the exact non-mutating request set, response classification, network failure, deadline/cancellation, retirement/server-only UI, refresh and unmount. Repository/admin TypeScript and the existing cleanup-inventory integration cases are included in validation.

This change requires a frontend merge and Readdy publication. It contains no Edge Function, SQL, payment, payout-policy, scheduler or credential changes. Published visual acceptance remains pending until that publication. It does not sign off independent payout lifecycle or launch/UAT gates.

Reference: [Supabase browser invocation and CORS](https://supabase.com/docs/guides/functions/cors).
