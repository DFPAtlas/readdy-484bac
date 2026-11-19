# Job History review relationship: follow-up to PR #176

## Live retest result

After #176 was published, the client test account still received a Job History
load error. Assigned guard details passed: the existing inactive guard appeared
by name with the recorded SIA verification status.

The remaining history failure is a PostgREST relationship error. The application
schema has no foreign key from `client_reviews` to `guards`. The query embedded
`guards(full_name)` regardless of whether reviews existed, so PostgREST rejected
the request before returning any rows. A read-only REST request with `limit=0`
reproduced HTTP 400 / `PGRST200`; inspection of the actual foreign keys confirmed
the missing relationship.

The earlier test fixture checked columns but did not check relationship metadata.
It accepted an embed which the live API rejects. This PR adds a relationship-only
fixture from the inspected schema and validates embeds before filtering rows,
matching that PostgREST behavior. The endpoint regression failed against the old
implementation with this stronger fixture.

## Correction

Read review rows directly, preserving both the verified client ID and the owned
job-ID filter. Derive guard IDs from those scoped rows and fetch only `id` and
`full_name`, in batches of 100. Preserve the existing response shape without
requiring an application or assignment to still exist. Missing guard records are
labelled unavailable; database failures remain errors rather than empty history.
No constraints, permissions, RLS policies or private profile fields change.

The retry UI also remains in its loading state while a refresh is pending, rather
than briefly claiming there are no jobs after clearing the previous error.

## Validation and release

Regression cases cover the absent relationship with zero reviews, successful
history retrieval, owned/foreign job and client boundaries, display names for
reviews without assignments, missing profiles and failed profile reads. Existing
history filter/pagination and signed-out/closed-account tests remain in force.

After review/merge, redeploy **only `get-client-job-history`** with the merged
source and its existing internal-authentication configuration. The deployed
assigned-guard function is unchanged. No migration is required. The server fix is
compatible with the already published frontend. Publishing the new frontend adds
the retry loading-state polish.

Retest while signed in: confirm all nine fixture jobs load, filters and guard
search work, reviews render without the missing-relationship error, and a retry
does not briefly show an empty account. Do not mark Job History passed until that
signed-in live retest succeeds. Financial summaries and lifecycle findings remain
open separately.
