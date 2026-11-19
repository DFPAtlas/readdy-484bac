# Client Advanced Matching repair (C04)

The signed-in client catalogue rendered zero verified guards when its private `guards` query failed. It selected unsupported columns (`specializations`, `languages`) and private fields, then ignored Supabase's returned error. The approved public catalogue currently contains two SIA-verified profiles.

## Change

- Read the existing `app.guard_public_profiles` view using its actual supported columns. The view restricts rows to active, approved/verified guards; the catalogue additionally requires `sia_verified = true`.
- Show an alert and Retry for returned errors, thrown errors and malformed list responses. Failed reads show unavailable counters instead of invented zeroes. Refreshes clear old actionable results; older or unmounted requests cannot overwrite current state.
- Search public city/location and outward postcode area. Licence filters accept stored labels, underscores and hyphens, and offer actual supported licence categories. Missing experience/rates do not count as entry level or a cheap rate. Unsupported languages, specializations and private SIA expiry/number fields are omitted.
- Preserve current score recomputation, sorting and public profile details. Describe the deterministic comparison accurately and availability as a guard's recorded status rather than guaranteed live capacity.
- Load bookmarks from the client's actual favorites. Track invitations separately by job and guard; a bookmark no longer prevents inviting a guard, and an invitation no longer appears as a bookmark. Check returned write errors before success feedback.

No grants, RLS policies, migrations or server functions change.

## Invitation boundary

Invitation records still use the existing client-owned `job_invites` path, which guards read in Job Invites. The previous direct notification insert depended on reading a private guard `user_id`. That branch is removed rather than exposing account identifiers through the public catalogue. Success feedback describes the created inbox record. Bell/email delivery is **not implemented or validated by this repair** and remains follow-up work through a server-authorized notification path. No invitation or notification was sent during these checks.

## Validation

- Component regression tests enforce the live public-column contract, reject private-table reads, cover eligibility, errors/retry/empty states, licence/search/rate/experience filters, sorting, details, independent bookmark/invitation state, failed and successful simulated writes, missing sessions, request races and unmounts.
- Read-only live database check under the existing client's authenticated role: one owned client, two eligible public profiles, and successful client-scoped favorites/invitations reads. This is a database access check, not a published browser acceptance test.
- Run repository unit tests, lint, typecheck, admin typecheck and production build before opening the PR. Record final results in the PR description.

## Release and retest

After review and merge, pull latest main into Readdy, publish and hard-refresh. No Supabase deploy or migration is required.

1. Sign in as the existing client test account with Advanced Matching access. Confirm eligible profiles, counters and public details load. Reconcile against the eligible public view at retest time; guard state can change.
2. Search names, city and postcode area; test licence label variants, experience/rate filters, all sort options and Clear Filters. Confirm a genuine no-match result differs from a failed request.
3. Temporarily block a request in the test environment; confirm a visible error, unavailable counters and successful Retry. Navigate away during a pending request and verify no stale update.
4. In a controlled test fixture, save/unsave and reload; invite a verified synthetic guard to an owned eligible synthetic job; confirm job-specific duplicate handling and the guard's Job Invites entry. Do not use an invitation that could notify or recruit real guards. Server-side bell/email delivery needs its own implementation and delivery test.
5. Keep C04 open until the published signed-in checks pass. C05 replacement-status loading is next. Other client launch blockers remain open.
