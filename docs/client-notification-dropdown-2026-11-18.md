# Client dashboard notification dropdown recovery

## Problem and repair

The full client inbox was repaired in PR #166, but its dashboard dropdown still only logged read errors. It could show a failed load as an empty list and mark notifications read locally even when the database rejected the update. Clicking a notification action also closed the dropdown and navigated away before its automatic mark-read request finished.

The dropdown now shows an accessible load-error state with Retry. A successful empty array remains a normal empty list; error or malformed responses cannot become a false empty result. Counts are hidden while loading or unavailable. Reads retain the existing client-owner scope, priority/date ordering, twenty-item limit and app-schema realtime subscriptions.

Single and mark-all read actions reuse the verified-owner write helper from PR #166. They update only IDs returned with the expected persisted read flags. Zero-row, partial, thrown and returned errors show an unconfirmed-change warning and trigger a fresh read. The warning acknowledges that a network failure can happen after a write commits. New notifications arriving during mark-all are not marked read locally.

A shared synchronous action lock blocks overlapping requests. Account-specific lifetimes and request sequencing discard earlier identities, older realtime reads and completed requests after unmount. A notification action waits for its automatic mark-read step to be confirmed before closing and navigating; on failure the warning stays visible, with reload and View All available. Navigation uses the existing job-link normalizer.

## Validation

Eleven new dropdown tests cover returned/thrown/malformed loads and retry; true empty results and query scopes; failed single/mark-all actions; duplicate clicks; partial/zero-row acknowledgements; notifications arriving during writes; action navigation and cancellation after closing the panel; account changes; unmounts; and rendered alerts/disabled controls. The targeted set also includes the twelve existing inbox tests and three notification/template dependency tests (26 targeted tests in total).

All 455 local unit tests passed, including the eleven new dropdown tests. The 26-test targeted and related set, TypeScript, repository lint, the admin/financial gate and the final production build also passed (212 static pages). Targeted lint has no warnings; the eight existing blog image warnings remain in the repository/build output. Automated failures use mocks. The production build uses the loopback Supabase placeholder from PR #164. GitHub checks remain the merge gate; live signed-in checks are still required after publication.

## Deployment and signed-in checks

Wait for GitHub checks to pass before merging, then import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

Open the client dashboard notification bell. Mark a notification read and verify its state after reopening and reloading. Check mark-all with multiple unread notifications, then open a notification action and verify navigation. With mocked load or write failures, expect Retry or an unconfirmed-change warning; an unconfirmed automatic mark-read should keep the panel open. Verify that the full inbox remains accessible through View All. Live signed-in checks remain outstanding until publication.
