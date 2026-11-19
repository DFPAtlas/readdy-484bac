# Client job-tracker repair (C06)

The tracker omitted deleted-job filtering and only understood six of the deployed lifecycle states. Paid-out bookings therefore appeared as Pending Review, and its progress label searched for the first matching step, which also left supported later states at Step 1. Completed assignments were counted as guards currently checked in.

The tracker now shares one explicit lifecycle mapping across filters, cards, progress and counters. Paid-out, completed, payout-approved and review-pending work appears in Completed at Step 5, with its own accurate label; Payout Pending does not claim settlement. Awaiting completion approval remains actionable. Draft, cancelled and closed bookings show their recorded label without invented completion, and unknown states say Status unavailable. Draft/closed records are available in All Jobs, rather than being treated as active or presumed successfully completed.

Every list/count request is client-scoped and excludes deleted jobs, including refresh and Load More. Ordering is stable by creation date and ID. The page states Showing X of Y for the selected tab; summary cards explicitly describe loaded jobs, not account-wide totals. Attendance uses current on-site semantics and ignores finished/cancelled assignments and terminal jobs. Current replacement counts refresh with replacement events. Failed enrichment reads surface an error instead of fabricated zeroes, and superseded/retired requests cannot overwrite newer tabs or another client.

No database migrations, grants, policies or server functions change. This does not repair the separate payment-summary, cancellation, review-queue or Trust & Safety workstreams.

## Validation and release

Regression fixtures cover all deployed job status values, terminal/unknown rendering, progress, tab counts, owner/deletion scope, pagination, current attendance, missing/error responses, overlapping filters, auth gating, client switches, realtime cleanup and unmounts. Record repository checks in the PR description.

After review and merge, pull latest main into Readdy, publish and hard-refresh. No Supabase deployment is required. Retest while signed in:

1. Reconcile every tab against current owned non-deleted data. At the schema check, this test account has four paid-out jobs, four cancelled jobs and one draft; two deleted jobs must stay excluded. Active is empty, Completed has four, Cancelled has four, All Jobs reaches nine after loading more, provided the account data has not changed.
2. Paid-out cards say Paid Out and Step 5 of 5; payout-pending and completion-approval fixtures retain their distinct meanings. Draft/closed/cancelled/unknown states do not invent payment/completion or actionable attendance problems.
3. Confirm page counts, Loaded Jobs summaries and Load More remain consistent when switching tabs and refreshing. Historical attendance must not become a current check-in/no-show warning.
4. With controlled synthetic active fixtures, test check-in/checkout/late/no-show and replacement transitions, stale requests, errors and Retry. Do not create real guard notifications or financial actions merely to populate this test.

C06 stays open until published signed-in acceptance passes. Other client launch blockers remain recorded in the consolidated repair inventory.
