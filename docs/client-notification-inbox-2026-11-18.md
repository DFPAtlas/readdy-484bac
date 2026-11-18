# Client notification inbox recovery

## Problem and repair

The client notification inbox ignored errors returned by Supabase for profile and notification reads. A failed query could therefore look like an empty inbox or a missing profile. Single and bulk read/unread/delete actions also changed the display without checking the database response.

The inbox now distinguishes successful empty results from failed reads, with an accessible error and retry state. Only confirmed signed-out and missing-profile results redirect. Owner-scoped reads retain the existing category, priority, status, search and date filters. Search values are quoted so punctuation is treated as part of the search value.

Every mutation re-verifies the signed-in owner, scopes writes by both owner and selected IDs, and requests the affected rows. Read/unread changes must return both expected read flags. Only acknowledged IDs change locally. Zero-row and partial results show a warning, and bulk selections retain unconfirmed IDs. Returned or thrown errors cannot produce a false success. A network error may still occur after a write commits, so the message says the changes are unconfirmed and the inbox reloads to reconcile the actual state.

A shared synchronous lock prevents overlapping single, mark-all and bulk actions. Pending controls are disabled. Request sequencing and page lifetime checks discard older filter/refresh results and avoid state changes after unmount. If filters or realtime updates arrive during a mutation, the latest filters are loaded after it finishes. The INSERT/UPDATE realtime subscriptions now reference `app.notifications`, matching the client's configured schema. No publication configuration is changed.

## Validation

Twelve targeted mock tests cover scoped reads and quoted search values; failed reads versus confirmed empty results and redirects; verified-owner writes; returned/thrown/zero-row/wrong-owner/mismatched acknowledgements; partial batches; retries and late reads; failed actions; duplicate submissions; filter changes during writes; unmounts; route-guard/realtime setup; and rendered alerts and disabled controls.

All 444 local unit tests passed, including the twelve targeted inbox tests. TypeScript, repository lint, the admin/financial type gate and the complete production build passed (212 static pages). Targeted lint has no warnings; the full build retains only the eight existing blog image warnings. All automated failure tests use mocks. Production build validation overrides the tracked public Supabase settings with `http://127.0.0.1:9` and a placeholder key. GitHub validation and signed-in post-publication checks remain outstanding.

The user explicitly approved publishing the repair branch and opening a pull request in the public QuickGuard repository on 18 November 2026. GitHub checks remain the merge gate.

## Deployment and signed-in checks

After GitHub checks pass and the PR is merged, import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

In the signed-in client inbox, verify that marking a notification read survives reload; read/unread filters show the expected rows; and single and bulk deletion remove the intended notifications. Switch filters quickly and confirm the final selection wins. Check read/unread/delete error cases with mocked failures, preserving the rows and unconfirmed selections. A failed initial load must show Retry rather than the empty-inbox message. This repair's live signed-in checks remain to be performed after publication.
