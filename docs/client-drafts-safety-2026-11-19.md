# Drafts and current safety warnings — C10 / C13

## Published retest and ticket-schema follow-up

PR #182 is merged and published. Signed-in My Jobs shows Draft Jobs 1, Saved
Wizard Drafts 1, Completed 4 and All Jobs 9. Both draft tabs select the correct
record. Continue restores the selected saved form, including 3 December 2026,
18:00–22:00, and survives reload. Dashboard Draft 1 and Completed 4 agree.
No draft was saved or posted during this retest.

Trust & Safety still fails with the explicit load error, including after Retry.
The deployed `app.support_tickets` schema uses `related_job_id`, not `job_id`.
This follow-up selects `job_id:related_job_id` to preserve the incident model's
existing field name. It retains client/deletion filters and incident history.
No schema change or function deployment is required.

A schema snapshot from the deployed table now validates ticket projections,
filters and ordering in the regression fixture, including empty tables. The
legacy query failed before the fix; linked, unlinked, foreign and deleted ticket
cases pass after it. A read-only corrected SQL projection under the existing
authenticated client role succeeds with three visible tickets, two linked to
jobs. This SQL check does not establish a published page pass: C13 remains open
until the follow-up is published and its incident/history/warning UI is retested.

The dashboard separately still shows three historical attendance alerts despite
zero operational jobs. That remains a C06/dashboard follow-up, outside this
ticket-schema correction. Controlled positive shift, licence, save/post and
fault-injected live acceptance remain outstanding.

Follow-up validation: all 596 unit tests pass, including 20 focused safety/draft
and request-lifecycle checks. Repository typecheck, admin checks and lint on
the changed code pass. The schema-aware regression failed before the query fix.
GitHub Build Check must pass before merging this follow-up.

The original implementation and pre-release validation below are retained as
historical evidence; their pending-publication language is superseded by this
retest.

My Jobs counted only saved wizard forms as Drafts, loaded that count only after
opening the tab, and hid actual draft job records. Completed summaries also
excluded paid-out work. Trust & Safety generated upcoming-shift warnings for
cancelled/finished jobs, used date-only midnight for urgency, treated `specific`
as a licence type, and computed warning counts separately from the rendered list.

## Changes

- Draft Jobs counts and filters `jobs.status=draft`. Saved Wizard Drafts is a
  separate tab for `job_drafts`. Both are loaded with the account summary; the
  explanatory copy states their different scopes. Continue links identify the
  selected saved form and the posting wizard reads it with client ownership.
- Restoring a saved form accepts only recognised fields of the expected types,
  sanitises times, keeps current client contact context, and does not post a job.
  Missing/foreign/invalid drafts show an error with Retry. Retired requests cannot
  overwrite a newer form. Draft saves check the database result before success.
- Completed tabs and counters use the existing tracker completed-work states.
  Scheduled drafts require draft status and a future publish time. Job summary
  and saved-form reads page through results. Initial and Load More requests use
  the same status filters, sorting, ownership and deletion scope.
- Current safety warnings and summary counts cover explicit operational states.
  Draft, deleted, cancelled, finished, closed and unknown-status records do not
  generate actionable upcoming-shift warnings. Historical jobs and incidents
  remain available in their record tabs. My Jobs Needs Action uses this scope too.
- Starting-soon calculations use the recorded start date/time in Europe/London,
  including daylight saving. Invalid/missing times do not invent critical urgency.
  Checklist completeness counts the eight booleans rather than metadata columns.
- Real licence arrays and canonical labels replace generic `specific` text.
  Matching checks all recorded licence types. Current assigned guard compliance
  uses the existing owner-checked profile endpoint; failed/missing data is explicit.
- Warning lists and counts share one calculation. Dashboard safety summaries use
  it too. Failed safety, checklist, ticket or profile reads show an error/Retry
  rather than reassuring empty success. Closed-screen requests are retired.
- The unverified hardcoded support telephone and availability claims are removed
  from the safety contact card. It links to the existing Support Centre and keeps
  the existing support email. No new telephone number is asserted verified.

## Validation and release

All 594 repository unit tests pass; typecheck and admin/financial checks pass.
Lint has no errors and eight existing blog image warnings. The final production build
passed on this source. GitHub Build Check is still required before merging.

Coverage includes actual job-query scopes and pagination, separate draft reads,
owned-form restore, form whitelisting, malformed/failure states, retired requests,
terminal-job exclusions, same-day and UK daylight-saving starts, licence arrays,
checklist metadata, matching warning counts, retained incident history, private
profile field exclusion and error rendering. The existing same-size job-change
regression remains covered against the refactored safety assignment loader.

Read-only production targets for the existing client test account are Draft Jobs
1, Saved Wizard Drafts 1, completed work 4, operational jobs 0 and all jobs 9.
No live job, draft, safety record, incident, payment or notification was changed.

After review and merge, pull latest main into Readdy and publish to quickguard.uk.
No database migration or function deployment is required. Keep C10/C13 open until
the published signed-in retest passes. Check both draft tabs/counts, selected-form
Continue and reload, four completed records, no cancelled-job starting-soon alert,
zero current operational warnings for this data state, retained incidents and the
Support Centre link. Use controlled fixtures for positive upcoming/current shifts,
licence/expiry changes, forced live Retry, saving and draft-to-post transitions;
do not advertise a real test shift or create payment activity for this display check.
