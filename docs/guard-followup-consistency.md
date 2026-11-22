# Guard display and read-confirmation repairs

The mobile dashboard previously calculated profile progress using twelve fields,
while desktop used a weighted seven-field score. Both now use the desktop score,
counting zero years of experience and excluding missing or whitespace values.
This display score does not grant identity approval or working eligibility.

The mobile plan badge reads the signed-in guard's current entitlement instead of
legacy profile subscription fields. Paid trials retain their plan name, both
cancelled spellings are recognised, and failed reads show Plan unavailable.

Mobile client-response marking now filters by the response and guard, confirms
the returned read flag, and checks account continuity. Failed or zero-row writes
retain the unread state and show recovery instead of apparent success. This is
separate from the conversation inbox's message-read workflow.

The shared usage hook maps the server's snake_case plan and period fields into
the UI model. It rejects malformed replies, clears stale allowances on refresh
failure, and prevents superseded or changed-account requests from publishing
their results. Guard and client widgets retain the same public hook interface;
usage remains caller-bound and read-only. Application consumption remains on
the authoritative server path.

Ten new regressions exercise the actual React screens and hook, including
server errors, zero rows, account changes, late responses, unlimited plans and
missing entitlements. Full repository validation is recorded in the PR.

Rollout requires merging, pulling into the existing Readdy project and
publishing. No migration or Edge Function deployment is needed. Live browser
acceptance remains pending a stable guard session after concurrent admin work
finishes. Planned PDF statements, profile boost placement and token checkout
redemption remain outside this repair.
