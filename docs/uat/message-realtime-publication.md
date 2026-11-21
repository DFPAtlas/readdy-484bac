# Messaging live-update repair — 21 November 2026

Client and guard messaging subscribe to INSERT and UPDATE events on app.messages.
Both production and the isolated sandbox published app.notifications through
supabase_realtime, but omitted app.messages. A channel could say SUBSCRIBED while
no message changes reached the recipient.

## Reproduction and verified correction

The private test driver rendered the existing client ChatPanel and exercised
the real shared job-messages.ts and client-notification-inbox.ts against the
isolated branch using genuine client/guard Auth sessions. Only module import
paths were adapted; those production implementations were not rewritten.

The client composer retained its draft on a simulated failed acknowledgement
and while a delayed acknowledgement was pending, then cleared it after the
actual save. Message ba6f7c31-ad1c-4369-9e04-220e79b297da saved at 11:53 GMT,
but the guard subscription received no INSERT. Receipt
1d6e2ed0-d3a6-496e-b91d-21f750a1a8f1 records SUBSCRIBED/delivered=false.
Read-only catalog inspection confirmed the same omission in production.

After applying this migration only in the sandbox, live authenticated
subscriptions received both client and guard INSERTs and sender read UPDATEs.
Three messages persisted, all read, and exactly one notification per message
was stored for its intended Auth user/type/category/link. Actual shared code
also verified same-request replay, changed-payload rejection, wrong-account
and unrelated-job denial, sender/recipient read boundaries, partial bulk
acknowledgements, read/unread persistence, contact lookup for profile-only
accounts, category filtering and foreign notification read/write denial.

Sandbox acceptance receipt 5bd89017-e0fa-4ee1-bb8e-14731ed334fe at
11:55:04 GMT retains all event IDs and checks. Test guard sessions were revoked
after each operation; final count zero. Outbound email remained isolated.
The full production messaging pages and external email delivery are not
claimed as exercised by this controlled driver.

## Change and validation

The migration adds only app.messages to the existing Supabase publication.
It preserves RLS, policies, SELECT grants, replica identity, existing
publication members and all message rows. It is a no-op if already enabled.
If the required publication is missing, it fails clearly instead of creating
an unexpected replacement.

Two PostgreSQL regression checks passed: idempotent publication membership
with unchanged RLS/grants/policy state, and explicit failure with no mutation
when the publication is absent. Sandbox security advisor findings were
unchanged. The test driver's TypeScript check and production build passed.

## Rollout

Production is not changed by opening this PR. After merge, apply canonical
migration 20261121115426_enable_message_realtime.sql to the production project.
No frontend publication or Edge Function redeployment is needed. Verify
app.messages and app.notifications remain present in supabase_realtime.
Clients must reconnect existing message subscriptions after deployment.

If live updates need to be disabled again, remove only app.messages from the
publication. This stops message events while preserving saved conversations
and their access rules. Do not reset data or weaken RLS.
