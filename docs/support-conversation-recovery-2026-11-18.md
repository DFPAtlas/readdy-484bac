# Support conversation save and load recovery

## Problem and scope

The guard and client ticket drawers previously treated the message insert and subsequent ticket-status update as one success boundary. A reply could already be saved when the status update failed, leaving the draft populated and showing a failed-send error. The client delivery invocation was also skipped when the status update failed. History failures could appear as an empty conversation, with the only error hidden inside the reply box on resolved tickets.

This frontend change builds on PR #162. It does not change database permissions, message visibility, ticket ownership or the existing client-only delivery route. Guard replies remain in QuickGuard; it does not add guard forwarding.

## Resulting behaviour

- A confirmed message insert immediately clears the submitted draft and shows “Your reply was saved.”
- A failed, thrown or zero-row status update produces a separate warning and does not request a resend. The update requires both the expected ticket ID and status, so a concurrent status change is not overwritten.
- Client delivery is still attempted after a status-update failure. Delivery errors become warnings about an already saved reply.
- An unconfirmed insert retains the draft and asks the user to reload the conversation before retrying. This does not provide server-side idempotency for an insert whose response is lost.
- A synchronous send lock blocks rapid repeat clicks. Closed/resolved tickets, failed/loading history and stale ticket callbacks cannot start a reply.
- History errors and malformed read results show an alert and retry action, including on closed tickets. Only a successful array result can show “No replies yet”. A successful retry clears the history error.
- Request sequence and ticket-lifetime checks reject outdated, switched-ticket and unmounted responses. Ticket status resets when the selected ticket changes.

## Validation

18 targeted tests passed across support-conversation recovery, support-inbox reads, guard-ticket ownership and existing message lifetime coverage. They use synthetic data and mocked delivery; no real support messages or email are sent.

TypeScript passed. The production build and admin/financial type gate are being checked before review; GitHub CI will run repository lint, TypeScript, admin/financial checks, the complete unit suite and the production build.

## Deployment and review

After checks pass and this PR is merged, import the latest main into Readdy and publish. No SQL migration or Edge Function deployment is needed. Signed-in browser checks should confirm guard/client conversation loading and reply rendering; failure-path tests above cover saved replies with downstream errors without sending live messages.
