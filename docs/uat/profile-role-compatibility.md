# Profile-only account compatibility — acceptance follow-up

The published review flow returned HTTP 403 for the existing controlled client during the 20 November 2026 acceptance pass. Its Auth identity is active, its client profile is active/non-suspended, and no account closure exists. It has no legacy `app.users` mirror. `resolveAccountState` already accepts this profile-only shape, while PR #203's shared `qg_active_message_role` returned NULL. No review was committed; the modal retained its draft and displayed the unconfirmed-save error.

Read-only metadata found four active client profiles and two active guard profiles without mirror rows. These counts describe profile shapes, not a certification that every account meets every other eligibility check. The message/notification foreign keys correctly reference `auth.users`, so no mirror backfill is required by those constraints.

## Correction

The additive migration replaces two existing functions:

- `qg_active_message_role`: when the mirror row is absent, derive the role from exactly one server-owned client profile and no guard profiles, or one guard profile and no client profiles. Preserve stored role authority where a mirror exists. Missing, duplicate and mixed-role profiles remain denied. Keep the active Auth, ban, closure, active-admin, active-client/non-suspended and active-guard checks.
- `get_my_message_partners`: use requested Auth IDs with an existing owned message relationship, and allow the optional mirror to be absent. Return the same minimal contact fields from role profiles. Unrelated accounts and other users' conversations remain unavailable.

No Auth metadata grants a role. No user/profile row, entitlement, financial record or grant is inserted or changed by installation. The helper remains private; the owned contact RPC keeps its existing authenticated boundary.

## Regression evidence

`tests/profile-role-compatibility.test.cjs` first installs the original three migrations and reproduces the live rejection. It then applies the correction and exercises profile-only review submission/replay, hidden moderation/job completion, client/guard messaging and notification recipients, minimal peer names, ticket create/close, transaction bells, foreign ownership, preferences, private-function grants, bans/deletions/closures/inactive/suspended/duplicate/mixed profiles and forged user metadata.

The PostgreSQL fixture includes the deployed Auth foreign-key boundary for messages and notifications. The tests run locally without production communications or financial operations.

## Release and resumed acceptance

After merge, apply `20261120183707_quickguard_profile_role_compatibility.sql` to QuickGuard. Its final NOTIFY requests the API schema reload. The already-deployed Edge Functions call the replacement functions dynamically: no additional Edge Function deployment or frontend publication is required for this correction.

Resume the retained synthetic review draft. Require one hidden review, the expected confirmed job state, unchanged-retry recovery and post-submission history. Then continue profile-only messaging/support/notification acceptance with controlled identities. The separate pre-existing sandbox/live billing mismatch must still be resolved before financial acceptance; this migration does not change payment mode.
