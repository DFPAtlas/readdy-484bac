# Client attendance issue saves

## Confirmed problems

The attendance panel ignored returned update errors and reported success for zero updated rows. Other/performance reports also overwrote attendance as late. Resolving an issue wrote once from the guard card and again from the panel. Save failures were silent and async completion/timers could update a retired page.

Read-only inspection of QuickGuard production metadata confirmed the issue fields exist and authenticated users have table privileges, but assignment UPDATE policies permit administrators only. Clients have an owner-scoped SELECT policy. The account-closure policy is restrictive. There is no existing client attendance/issue RPC. Direct browser updates therefore cannot implement this workflow for ordinary clients.

## Repair

The new `client-attendance-issue` Edge Function validates the bearer token with `auth.getUser`, checks account closure, verifies the submitted client belongs to that user, verifies job ownership and non-deletion, and loads only an assignment belonging to that job. Body identifiers and report type/length are validated. It constructs the permitted issue-field updates itself; request-body payment, status and other fields cannot be forwarded.

No-show/late reports may mark arrival only when there is no recorded check-in/out evidence or terminal assignment state. Other/performance reports and issue resolution preserve attendance. The update includes the loaded assignment's `updated_at` value, so a concurrent check-in/edit returns an unconfirmed-change response instead of overwriting it. Zero rows, returned errors and mismatched acknowledgements cannot produce success. No table grants or RLS policies change.

The browser calls this endpoint and validates the saved ID/job/issue fields. Report and resolve actions share a synchronous lock. The guard card delegates resolution without its own database write. Failed reports retain their notes and show an accessible error; confirmed saves update the parent's assignment state immediately, with existing realtime subscriptions retained. Job/client keys retire page state and pending callbacks when context changes; timers clean up on unmount. Pending saves disable conflicting report edits/actions.

## Validation

Twelve new tests cover server authentication/ownership/closure checks, malformed requests, read/write failures and zero-row acknowledgements, issue-field limits, attendance-evidence preservation, optimistic concurrency filters, browser acknowledgements, failed reports/resolution, duplicate clicks, unmounts, timer cleanup, single delegated resolution and HTTP/auth/JSON errors. The focused set also includes existing replacement-request and attendance-display regressions (27 tests).

All failure and mutation tests use mocks. Production inspection read metadata only; no live assignments, tickets, payments, notifications or emails were modified. Full-suite, frontend/endpoint TypeScript, repository lint, admin/financial checks and production-build results are recorded in the PR. Endpoint TypeScript checking supplies ambient declarations for Deno and remote imports; handler tests execute with mocked imports. A real hosted end-to-end request remains outstanding.

## Deployment

After review, green GitHub checks and merge, deploy `client-attendance-issue` to QuickGuard project `vnywjfpkepjgclkbcmsj` using its committed JWT configuration. Deploy the endpoint before importing latest main into Readdy and publishing. No database migration is required. Until the endpoint is deployed, this frontend will show an unconfirmed-save error rather than success.

On an approved test assignment, report an Other issue and reload: notes/issue state must persist and attendance must remain unchanged. Resolve and reload. Repeat no-show/late on an assignment without attendance evidence; on one with check-in/out evidence, ensure that evidence remains intact. With mocked write failure, expect an alert and retained report notes. Duplicate clicks must issue one save. Leaving the job during a pending save must not update the next page. A concurrent assignment edit must ask for reload. Use dedicated test accounts for owner, foreign-owner and closed-account end-to-end checks; live signed-in checks remain outstanding.
