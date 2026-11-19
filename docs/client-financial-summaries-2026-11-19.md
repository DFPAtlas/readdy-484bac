# Client recorded payment summaries — C07

## Published retest and compact history badge follow-up

PR #185 is merged and published. Signed-in Payment Centre, Payment History,
Job History, profile billing and All Time Reports all show £551 gross job
payments, £204 refunds and £347 net. Payment History and Reports separately show
£98 subscription gross/net and £0 subscription refunds. Payment Centre has zero
current payable booking value and zero November gross job payments. Report
finance detail agrees; its Last 30 Days preset shows zero collected job payments
and £49 subscription payments. All Time restores the all-time amounts. Custom
native date entry did not establish a report-state change in this automation
attempt and remains unverified live; UK boundary logic has automated coverage.

All four paid-out Job History cards now say Paid. A remaining serializer/display
gap leaves the partial-refund history card incorrectly marked Paid while its
expanded transaction says partially_refunded. The history API retains refund
state but omits refund_amount from each nested transaction. The follow-up badge
honours explicit partially_refunded state without inventing an amount. Financial
summary arithmetic is unchanged and still reads the complete owned ledger.

The new regression runs the real history endpoint fixture, feeds its serialized
response to the actual label helper and reproduced Paid before this correction.
It covers paid-out and cancelled jobs plus a compact transaction with no refund
amount. The badge still requires a published retest after this follow-up ships.
No migration or function deployment is required.

Follow-up validation: all 615 repository unit tests and 24 focused finance/
history/refund tests pass. The endpoint-response regression failed before the
label correction. Typecheck, admin checks and changed-code lint must pass; their
final results and GitHub Build Check status are recorded in the follow-up PR.
The prior PR #185 production build is historical evidence, not a new build pass
for this narrow label correction.

The published dashboard also now shows zero current attendance alerts and one
assigned guard on each displayed paid-out recent job. Trust & Safety loads with
zero operational warnings and three retained incidents, including two job-linked
records; its Support Centre link opens the three-ticket support page. These are
core display passes, not positive attendance/compliance/mutation or fault-injected
Retry acceptance. No live record or payment was changed.

The implementation and pre-release instructions below are retained as historical
evidence and are superseded by the published results above.

The client pages used incompatible financial definitions. Payment History
counted completed jobs but omitted job refunds; Reports used a different subset;
Job History presented booking values as Total Spent; profile billing displayed a
cached clients.total_spent value. Payment Centre also summed pending attempts
without checking whether the booking remained payable.

## Recorded payment definitions

Gross Job Payments covers succeeded/completed/paid/refunded/partially_refunded
transaction rows owned by the client. Completed refunds come from the recorded
refund amount, full-refund status or legacy full-refund flag. Net Job Spend is
gross minus refunds. Pending, failed, processing and unknown attempts are not
collected funds. Recorded job payments remain in history when their job is
cancelled or deleted; filtering the current job list does not erase payments.
Subscription payments use the same arithmetic and are displayed separately.

Partial refund amounts take precedence over a legacy refund flag. Full-refund
status and missing-amount legacy full refunds remain supported; refunds cannot
exceed the payment amount. Sums use integer pence. The financial loader rejects
invalid amounts/refund amounts/dates and unsupported currencies rather than
displaying misleading zero totals or combining other currencies under £.

Selected report periods use payment creation dates in Europe/London, inclusive
of both selected dates, for jobs and subscriptions. Refunds are the recorded
lifetime refunds on those selected payments; this is not a period cash-flow
report. All-time financial summaries are explicitly independent of job-list
filters and pagination. Dashboard monthly gross uses the same UK date basis.

Awaiting Payment Booking Value covers one current, non-deleted awaiting_payment
job at most once. It uses the recorded agreed amount, or its latest pending
attempt when no agreed value is recorded. Cancelled/deleted/funded/already-paid
jobs and duplicate retries do not add debt. Unpriced current bookings show Price
unavailable. Booking value is explicitly not a settled charge.

## Implementation

Payment History, Job History, report overview and profile billing use one shared
recorded-spending component. Payment Centre and finance-report detail use the
same arithmetic/source definitions. Owned transaction/subscription/current
payable-job reads page all records with stable ordering. Failed reads show Retry
without zero-valued money cards. Financial refreshes retire old/closed-screen
responses. The summary does not use cached profile spend or the legacy history
API's booking-value total_spent field.

History payment badges use transaction payment/refund states independently of
job payout/lifecycle labels. A completed collected transaction no longer appears
Unpaid merely because the job-level payment label is stale. Partial refunds are
visible in history/detail labels without requiring the full-refund boolean.

Read-only production aggregates and an authenticated-role equivalent confirm
the existing test client's recorded all-time job totals: £551 gross, £204
refunds, £347 net. Subscription gross/net is £98 with £0 refunds. There are zero
current payable jobs. These are release retest targets, not a published UI pass
or an independent reconciliation with provider charge history.

## Validation and release

The broad repository run passed 613 unit tests; all 27 final focused finance,
dashboard and request-lifecycle checks pass, including the later-added report
refresh case. Repository typecheck and admin checks pass. Final lint has zero
errors and eight existing blog image warnings. Production-build completion and
GitHub Build Check are required before release; their final results are recorded
in the PR. An intermediate local build was stopped to remove two new ref-cleanup
lint warnings and is not pass evidence.
Tests include the recorded reconciliation fixture, partial/legacy refunds,
pence rounding, duplicate pending attempts, terminal/deleted exclusions, unknown
prices, retained history, owner filters, pagination, malformed/error reads,
currency protection, UK/BST date boundaries, summary/detail rendering and
superseded/closed-screen/error/Retry behavior.

After review and passing checks, merge, import latest main into Readdy and
publish. This is frontend-only: no migration or function deployment is needed.
Retest the job gross/refund/net totals on Payment Centre, Payment History, Job
History, profile billing and All Time Reports. Check subscription separation,
selected-date report totals, paid/partial-refund badges and zero current payable
booking value. Positive live error/Retry and mutations remain controlled UAT.

C07 remains open until the published signed-in checks pass. C08 provider
receipts/invoices, C09 support reports, C15 payment-method readiness and C16
cross-category export completeness retain their separate acceptance scopes.
No payment, refund, payout, subscription, booking or notification was changed.
