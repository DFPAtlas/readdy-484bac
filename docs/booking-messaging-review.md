# Booking history and support-message review

This batch is independent of PR 117 and is based on main after PR 116. It does not include or change PR 117's polling fixes.

## Repairs

- Job-history form edits remain separate from the applied query. Apply starts at page one with the edited filters; Clear resets the actual applied query rather than immediately requesting the old render's filters. Page changes drive one effect; refresh preserves the current page. Requests abort when their screen or authorization context changes, and cancellation is checked after session lookup and response parsing. HTTP failures are handled explicitly.
- Client and guard ticket drawers use ticket-aware stable loaders and monotonically increasing request IDs. Only the latest active ticket request can update messages or loading/error state. Switching tickets resets the displayed conversation and draft, and old channels are removed. An outgoing reply remains associated with its original ticket; its late result cannot clear the draft or alter local status on a subsequently opened ticket. Lifetime tokens also distinguish returning to the same ticket after visiting another one.
- Replacement booking status and replacement-notification effects own their loaders and cancellation state. Late or superseded realtime responses cannot replace newer data. Context changes clear old results and remove subscriptions. Removed-channel callbacks do not issue new reads.

No lint rules are disabled. This removes five dependency warnings from main (76 to 71) and reduces its total warnings from 599 to 594, with zero lint errors. If both PR 117 and this batch merge, their disjoint fixes should leave 67 dependency warnings; rescan the merged tree to verify that number rather than treating this projection as a completed check.

## Tests and limitations

Five focused tests cover both ticket drawers, preserving new drafts when previous replies finish, subscription cleanup, explicit Apply/Clear/page requests, unmount cancellation and out-of-order replacement updates. The complete suite passed 285 tests on this independent branch. TypeScript passed after a serial rerun; an earlier attempt overlapped Next.js regeneration of `.next/types` and therefore saw temporary missing generated files. Full lint/build results are recorded in the PR description.

No live message, support bridge request, job application, payment, publication, deployment or database change was performed. This is not a complete launch sign-off. Wider messaging, booking/detail and dashboard effects still require review.
