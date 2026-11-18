# Guard notification history recovery

## Problem and repair

The history screen ignored returned read errors, allowed thrown reads to escape, and changed read/delete/snooze state without confirming writes. Failed loads could look empty, failed snoozes could produce a success toast, and clearing notifications could include items arriving after the confirmation opened. Deleting the only item on the last page could leave an apparently empty page.

The screen now distinguishes successful empty arrays from failed or malformed loads, with an accessible Retry state. It blocks mutations until a successful owner-scoped load. Request sequencing and account lifetimes discard old reads, prior accounts and results after unmount.

Read/delete actions reuse the existing verified-owner notification helper. Snooze/wake-up uses a narrow helper that verifies the signed-in owner, scopes the update by guard owner/type/ID, and requires the saved timestamp or null to be returned. Equivalent timestamp encodings are compared by instant. Invalid or past snooze requests cannot write. The snooze toast reports the confirmed saved time and does not claim external reminder delivery. Its timer is cancelled on cleanup.

Only acknowledged IDs change locally. Returned, thrown, partial and zero-row results produce an unconfirmed-change warning, preserving unconfirmed rows and delete confirmation. A refresh reconciles writes whose network result is uncertain. A synchronous lock prevents overlapping read/delete/clear/snooze/wake-up actions, and controls are disabled while a write is pending.

Clear All snapshots the matching IDs when the confirmation opens, rather than adding newer arrivals. Its displayed count follows captured IDs that disappear on refresh; partial clears retain the remaining IDs. Existing type, read and snoozed filters determine the initial snapshot and mark-all set. Pagination clamps to the last available page after deletion or refresh.

## Validation

Fifteen new tests cover scoped snooze acknowledgements and timestamp normalization; invalid dates/accounts; returned/thrown/zero-row/wrong-owner results; load errors and retry; account lifetimes; failed and duplicate actions; filtered mark-all; stable clear snapshots and counts; partial/failed clears; confirmed snooze/wake-up and timer cleanup; last-page deletion; unmounts; and rendered alerts/disabled controls.

The focused set also includes the existing history sequencing test, twelve owner/inbox tests and five company contact tests (33 total). The existing history test now supplies the additional error setter without reducing its late-response coverage. This branch includes the contact-wrapper test-loader correction already reviewed in PR #168 because its base contains the newer contact wrapper; no contact application code changes.

Final full-suite, TypeScript, repository lint, admin/financial gate and production-build results are recorded in the PR description. Failure tests use mocks. Build validation uses the established loopback Supabase placeholder, with no production notification mutation or email delivery.

## Deployment and signed-in checks

After GitHub checks pass and merge, import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

In guard notification history, mark an item read and verify after reload. Check type/read filters, clear confirmation, single deletion, and deletion on the final page. Snooze an item, switch to Snoozed, reload, then wake it up and confirm its active state. With mocked failures, expect Retry or an unconfirmed-change warning and no false snooze success. Check that notifications arriving after clear confirmation are retained. Live signed-in checks remain required after publication.
