# Confirmed admin support-ticket saves

## Repair

The admin support-ticket editor previously considered an update successful whenever Supabase returned no error, including a successful request affecting zero rows. Its async callbacks also captured the selected ticket and could reopen it after the administrator closed the editor or switched to another ticket.

Note and status updates now require the intended nondeleted ticket row to be returned. The list uses the returned note/status/resolution fields. A zero-row, wrong-ticket, returned-error or thrown-error result never produces a success notice.

Each opening of the editor has its own identity, including closing and reopening the same ticket. A completed save can update its original row in the inbox but cannot replace another editor or display a notice there. Callbacks from an unmounted page do not write state. Old handlers cannot start a save after the editor has changed.

A synchronous shared lock prevents overlapping note/status mutations. New text typed while a note save is pending remains in the draft; a failed save retains it too. A confirmed save invalidates older inbox requests so an earlier read cannot overwrite the result. It does not start an unnecessary refresh that could turn a saved edit into a load failure.

No database schema, permission, MFA, ownership, status catalogue or delivery-route changes are included. This does not add cross-administrator optimistic concurrency or server-side idempotency.

## Validation

13 targeted tests passed: seven admin-write regression cases, four inbox-read cases and two guard ownership/requester cases. These use mocks and an isolated PostgreSQL fixture; no production ticket is modified. TypeScript passed. Targeted lint passed after correcting a test-only prefer-const warning.

The admin/financial gate passed, all 424 unit tests passed with concurrency limited to two, and the complete production build passed (212 static pages). The build reports only the eight existing blog image warnings. GitHub CI remains the final merge gate. The local validation build explicitly overrides the tracked public Supabase settings with a loopback placeholder. The GitHub Next build step uses the same overrides; its output is validation-only and is not deployed. Readdy production settings are unchanged.

## Deployment and signed-in checks

After GitHub checks pass and the PR is merged, import latest main into Readdy and publish. No migration or Edge Function deployment is required.

In the admin support inbox, check that a saved note and status persist after reopening the ticket. With a delayed mocked update, switch or close the editor before completion: the original ticket must not reopen, and the new editor's draft must remain intact. Repeat with a zero-row/error response: no success notice should appear. The automated tests cover these failure paths without changing a real ticket.
