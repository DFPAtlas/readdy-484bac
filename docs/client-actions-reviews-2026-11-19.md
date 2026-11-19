# Client terminal actions and review queues — C11 / C14

Paid-out jobs offered cancellation, and the Reviews page queried only `completed`
jobs although the existing submission service accepts `paid_out` / `review_pending`
jobs with completed, paid-out assignments.

## Repair

- Job Details and desktop/mobile job cards use the existing cancellation allowlist.
  Unsupported, deleted and terminal jobs do not offer cancellation. Opening the
  modal directly yields support guidance without refund resolutions; its submit
  handler checks eligibility again. The backend remains authoritative for current
  ownership, job state and payment/payout activity.
- Bulk cancellation calls `cancel_client_job` per eligible booking instead of
  updating job status directly. It reports successful, rejected and skipped jobs.
  The existing atomic RPC records any refund request for review; this does not
  approve or execute a refund or payout. Copy does not promise guard notification
  delivery that this path has not established.
- Reviews, Job Details and assigned-guard review actions share assignment-level
  eligibility matching the existing create-review service. Unfinished and unsettled
  assignments do not inflate the pending queue. Existing job/guard reviews remove
  that pair from the queue; closed-job reviews remain in history.
- Reads are scoped to the authenticated client and non-deleted jobs, page beyond
  server row limits, and obtain historical guard names through the existing
  owner-checked assigned-profile endpoint. Inactive accounts remain identifiable;
  absent profiles are labelled unavailable. The screen consumes only name/photo.
- Authentication, database and profile failures display Retry rather than a false
  empty success. Superseded requests, retired identities and unmounted screens
  cannot replace current results. Successful review submission reloads job state.

## Validation and release

583 repository unit tests pass. Tests exercise the actual existing cancellation
RPC in isolated PostgreSQL, rejection of terminal statuses without writes, the
existing review handler's ownership/state/duplicate checks, review queue/history
pagination, profile errors and privacy projection, stale requests, error rendering,
terminal modal rendering and partial bulk failures. Typecheck and admin/financial
checks pass. Lint has no errors and eight existing blog image warnings.

No production job, review, refund, payout or notification was changed or sent.
Review creation/moderation, retry/concurrency and guard delivery are not claimed
as full live acceptance from these tests.

After review and merge, pull main into Readdy, publish and hard-refresh. This uses
existing deployed endpoints; no migration or function deployment is required.
Retest the known four pending paid-out guard/job pairs, inactive identity display,
no cancellation on paid-out/closed work, and history after a controlled review.
Use isolated synthetic fixtures for eligible cancellation/refund-request and
review submission/moderation/concurrency acceptance. C11/C14 remain open until the
published signed-in retest and their controlled acceptance checks are complete.
