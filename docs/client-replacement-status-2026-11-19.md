# Client replacement-status loading repair (C05)

The Notifications replacement panel requested `jobs:job_id(title, location)`. Neither embedded job column exists in the deployed `app.jobs` schema, so the request fails even when the client has no replacement requests.

The panel now selects only the replacement fields it displays and maps `jobs:job_id(title:job_title)` to its existing title property. It no longer requests unused location fields or all replacement columns (including contact phone/notes). The client ownership filter, descending date order, realtime scope, retry handling and stale-request protections remain in place. No grants, policies, migrations or server functions change.

## Verification

- The schema-aware regression fixture validates embedded fields before returning rows. Its empty-list/ownership test failed against the old query and passed after the correction.
- Coverage includes successful empty and populated responses, actual job-title alias mapping, missing/hidden linked jobs, rendered status/details/job and support links, returned/thrown/malformed errors, Retry, realtime refresh, superseded requests, identity changes and cleanup.
- A read-only equivalent join under the existing client's authenticated database role succeeds and returns zero requests, consistent with its current data. This does not establish a populated production-browser pass.
- Record final repository unit/type/lint/build check results in the PR description. No live replacement request, job notification or support ticket was created for this repair.

## Release and acceptance

After review and merge, pull latest main into Readdy, publish and hard-refresh. No Supabase migration or Edge Function deployment is required.

1. Sign in to the client account and open Notifications. Ordinary notifications must still load, and the replacement panel must show its genuine empty state rather than a loading error when there are no requests.
2. With an authorized synthetic fixture in a controlled environment, verify populated request titles, status summaries, expansion and the job/support links. A missing/RLS-hidden linked job must not hide the replacement or crash the panel.
3. Exercise an authorized synthetic status update and verify realtime refresh. Check errors remain visible and Retry can recover, including after navigation or account changes.
4. Keep successful replacement creation, idempotent replay and support/Command synchronisation as separate acceptance work; this read-panel repair does not validate those paths.

C05 remains open until the published signed-in retest. The lifecycle/tracker workstream C06 follows.
