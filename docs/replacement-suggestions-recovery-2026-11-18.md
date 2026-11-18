# Replacement suggestion search recovery

## Problem and repair

The suggested replacement guards panel had no Refresh action after a successful empty search. Refresh failures could leave earlier candidates available to request, while null query results could be interpreted as successful empty results. Searches were not retired when a job, client, licence requirement or assigned-guard exclusion changed, or when the panel unmounted.

The panel now clears earlier candidates when a search starts, rejects returned errors, thrown errors and non-array results at every query stage, and shows a generic accessible error with Retry. Successful empty searches retain their support action and gain Refresh. Candidate availability remains explicitly unconfirmed.

The search state is keyed by job/client identity, licence requirement and the sorted assigned-guard exclusion list. A new context mounts fresh state and retires the previous lifetime. Request sequencing prevents older successes, errors or completion handlers from overriding newer searches. Retired requests stop before starting subsequent query stages; retired callbacks cannot restart a search. Missing client/job identity or a mismatched job object cannot issue a query.

Existing applicant, assignment, client-history and public-profile query scopes, selected fields, licence filter, exclusion rules, deduplication, ordering and five-candidate limit are preserved. This change does not modify replacement submission, booking, guard eligibility decisions or notifications.

## Validation

Eight new regression tests exercise initial/refresh recovery, pending and failed candidate refreshes, returned/thrown/malformed failures across all seven query stages, successful scopes/filtering/deduplication, missing context, overlapping requests, unmounts/retired callbacks and search-context keys. The existing replacement-request tests load the keyed child component and use Retry after a search failure.

Failure tests use mocked reads. The production build overrides the Supabase public URL and key with loopback placeholders. Full-suite, TypeScript, repository lint, admin/financial gate and build results are recorded in the PR. Live signed-in verification remains outstanding.

## Deployment and signed-in checks

After GitHub checks pass and merge, import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

On a client job with the replacement panel, search for suggestions and refresh them. A successful empty search should offer Refresh and support. During refresh, old candidate request buttons should disappear. With a mocked/blocked read, expect an error with Retry rather than an empty-result claim or stale candidates; restore connectivity and retry. Change jobs while a search is pending and confirm results belong to the current job. Candidate requests must still open the replacement form with the chosen guard; submitting that form is outside these read-only checks.
