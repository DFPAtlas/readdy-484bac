# Dashboard current attendance — C06 follow-up

The published dashboard showed three historical Guards Not Checked In /
Attendance Issues alerts while the existing client had zero operational jobs.
The aggregator applied attendance flags to all historical assignments and used
the viewer's local timezone to infer overdue check-in. Recent Jobs also showed
the stale jobs.assigned_count value instead of the loaded assignment records.

## Changes

- Current attendance uses the tracker's booked-work states: funded, confirmed
  and in_progress. Cancelled, finished, draft, deleted and unknown jobs do not
  create current attendance actions. Historical assignments remain loaded.
- Check-in, late and no-show alerts cover only an active recorded UK shift.
  Future and ended shifts do not appear overdue. The existing UK shift-phase
  helper handles overnight and multi-day bookings independently of the browser's
  timezone. Invalid or incomplete schedules do not invent an overdue check-in.
- Cancelled/completed assignments, completion timestamps, checkout timestamps
  and checked-out/completed attendance are excluded from current alerts. A saved
  check-in timestamp also prevents a stale confirmation from becoming overdue.
- Replacement-needed counts cover upcoming/current booked shifts and count
  distinct jobs, rather than one job per guard. They are separate from replacement
  request workflow records, which this repair does not certify.
- Jobs and assignments are paginated with stable ordering and remain scoped to
  owned, non-deleted job IDs. Recent Jobs uses distinct non-cancelled assigned
  guards, retaining completed historical guards instead of stale zeroes.
- Assignment errors and malformed results cannot become successful zero alerts.
  The page propagates returned/thrown stats failures into its existing Retry
  banner and hides summaries and job next actions until a successful refresh.

## Validation and release

The broad repository run passed 602 unit tests. All 26 final focused attendance
and tracker tests pass, including seven dashboard regressions and the later-added
returned/thrown-error and successful-Retry test.
Coverage includes historical/foreign/deleted exclusions, positive current
attendance, future/ended/overnight/BST shifts, checkout/completion, duplicate
guard identities, unique replacement-job counts, pagination, failed/malformed
reads and error rendering. The newly selected assignment completion/checkout/
confirmation fields and job end fields exist in the deployed schema.

Sequential repository typecheck and admin/financial checks pass. Lint has zero
errors and eight existing blog-image warnings. Production-build completion and
GitHub Build Check are required before release; see the PR for their latest
status. An initial overlapping standalone TypeScript check was killed by memory
pressure; the overlapping build was stopped, and neither is pass evidence.

This is a frontend repair: merge after checks/review, import main into Readdy
and publish. No database migration or function deployment is needed. Retest
the existing client's zero current attendance alerts, historical assigned guard
counts, and tracker/history consistency after publication. Positive attendance,
realtime and live fault-injected Retry remain controlled acceptance work; no
live shift, assignment, payment or notification was changed.

A fresh read-only production aggregate confirms the three legacy overdue
assignment flags all belong to cancelled jobs. Owned non-deleted job counts
remain four cancelled, one draft and four paid_out, with no booked-work state.
The paid-out records retain their historical assigned guard. These are release
retest targets, not proof that this dashboard candidate is published.

PR #183 has merged and its GitHub Build Check passed. Its Trust & Safety page
retest is still outstanding; this dashboard patch does not establish a C13 pass.
Other dashboard metrics, including review eligibility, billing and replacement
workflow totals, retain their separate repair/acceptance scopes.
