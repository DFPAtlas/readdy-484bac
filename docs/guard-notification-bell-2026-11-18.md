# Guard dashboard notification bell recovery

## Problem and repair

The guard notification bell logged failed reads but displayed the normal empty state. Single and mark-all read requests changed the display without checking the database result. View links closed the panel and navigated before their automatic mark-read request finished; clicking other parts of a linked row also closed the panel without navigation.

Failed or malformed reads now show an accessible error and Retry. Only a successful empty array displays the normal empty list. Counts are hidden during loading or failure. Reads keep the guard user/type scope, descending creation order, twenty-item limit and app-schema realtime subscription.

Read mutations reuse the role-independent owner verification and affected-row checks in `changeClientNotifications` from PR #166, imported locally as `changeOwnedNotifications`. The helper re-verifies the current account, scopes writes to the owner and requested IDs, writes both read flags, and acknowledges only returned rows with the expected persisted flags. The bell changes only confirmed IDs and warns about partial, empty or failed acknowledgements. It reloads after a write to reconcile network outcomes and notifications arriving while saving.

An account-scoped synchronous lock prevents overlapping writes. Request sequencing and account lifetimes reject older realtime responses, prior accounts and unmounted results. View waits for a confirmed read update before navigating through the existing job-link normalizer. An unconfirmed save leaves its warning visible. Closing the panel or choosing View All cancels delayed View navigation. The noninteractive row background no longer closes the panel.

## Validation

Eleven new guard-bell tests cover returned/thrown/malformed loads and retries; confirmed empty results and guard query scopes; failed single/mark-all writes; duplicate clicks; partial/zero-row acknowledgements; notifications arriving during writes; confirmed and failed View actions; cancellation after closing; changed accounts; unmounts; and rendered accessible alerts/disabled actions.

The 26-test targeted set includes those tests, twelve existing notification-owner/inbox tests and three existing notification/template dependency tests. Full-suite, TypeScript, repository lint, admin/financial gate and production build results are recorded in the PR description. Failure tests use mocks. Build validation overrides the tracked public Supabase settings with the loopback endpoint and placeholder key established in PR #164.

## Deployment and signed-in checks

After GitHub checks pass and merge, import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

Open the guard dashboard bell. Mark all displayed unread notifications read, reload and confirm their state. Open a notification through View and verify its destination. With mocked failures, expect Retry for a load failure and an unconfirmed-change warning for failed read updates; the panel must stay open after an unconfirmed View update. Close the panel during a delayed View update and confirm it does not later navigate. View All must remain available. Live signed-in checks are required after publication.
