# Guard Job Invites: loading, retained history and response recovery

The guard inbox discarded every invitation whose linked job was unavailable and
turned failed invitation reads into a successful "No invites yet" screen. It
loaded only one API page, had no Refresh/Retry, and could restore old results after
navigation or an account change. Unknown states defaulted to Awaiting Response;
a missing rate appeared as £0.00/hr.

## Resulting behavior

The inbox uses a minimal explicit projection checked against a current deployed
schema snapshot. Every page is guard-scoped with stable invited_at/id ordering,
200-row ranges and null timestamps last. Returned errors, thrown failures,
malformed ownership/relationships or a later-page failure reject the load. No
partial list, stale response buttons or fake empty success is shown. Overlapping
offset pages are deduplicated, and a non-advancing full page fails rather than
looping. This is not a transactionally frozen snapshot if invitations change
during pagination; Refresh retrieves the current list.

Only the invitation and existing visible job/company fields are selected. No
private address, contact, payment, verification-document or full profile fields
are added. RLS-hidden job/client embeds stay unavailable; the repair does not
elevate privileges or try to recover hidden data. Missing job details retain the
invitation's message/status/timestamps and an explanation; job navigation and
response/message actions are disabled for that row. Missing company details,
rates, times and dates are labelled. A recorded zero rate is preserved, while an
absent rate is not invented. Unknown/null status is Status unavailable and is
never an actionable pending invitation.

Refresh and Retry are explicit controls. Returning browser focus refreshes the
snapshot. Owned profile, invitation pages and final auth identity must agree
before rendering. Read generations, unmount cleanup, sign-in/sign-out reset and
request guards prevent earlier accounts/screens from restoring cards, modals or
success messages. A failed refresh hides old actionable cards until Retry succeeds.
Missing/inactive/unapproved guard accounts retain their existing login/onboarding
gates, with no intervening successful empty-state claim.

## Response and messaging guards

A synchronous response lock prevents rapid double clicks and disables response
buttons across the inbox while a response is pending. Refresh waits until that
response finishes, then reloads canonical state. Decline must confirm exactly one
matching owned pending invitation updated to declined; zero rows/errors/throws do
not announce success. Returned response timestamps are used rather than invented
display timestamps.

Accept & Apply continues through the existing `submitGuardApplication` /
`apply-to-job` / authoritative database application path. It still commits
acceptance/application together and relies on server ownership, lifecycle, plan
limit and replay enforcement. The redundant browser plan preflight is removed:
after a lost acceptance reply it must not block the server's existing replay just
because the successful first application consumed the remaining allowance. A
confirmed application ID is required before success; server limit failures retain
the upgrade route. Unconfirmed replies/errors trigger a current-state refresh and
do not claim the invitation remained pending or that an application succeeded.

Accepted-invitation Message Client remains the existing RLS-scoped lookup/modal.
Lookup errors are explicit and retired lookups cannot open a stale recipient
modal. The change does not send a message or certify messaging delivery.

## Verification and release

Thirteen focused tests run the actual loader and React page. They cover a
405-record owned list plus a foreign record, exact schema/projections, all pages,
empty versus returned/thrown/malformed errors, late-page failure, Retry,
missing/hidden relationships, unknown/null states, zero/missing values, stale and
unmounted reads, focus refresh, auth/access gates, rapid clicks, acceptance replay,
server plan limits, failed/zero-row decline and stale messaging lookup. Existing
shared application-path regressions remain required.

Read-only production inspection confirms the selected columns and actual foreign
keys. An authenticated guard-role equivalent join succeeds with **zero owned
invitations**, matching the production invitation count of zero. This is empty
read/schema evidence, not a populated guard-browser or response acceptance pass.
Project-wide validation and PR state are recorded in the consolidated acceptance
report and PR description.

All **698 repository unit tests**, including the 13 focused inbox checks, pass.
Repository TypeScript, admin/financial checks and lint pass; only eight existing
blog-image warnings remain. Production-build/CI results are recorded with the PR.

No migration, Edge Function, dependency, secret, policy or grant change is needed.
After green checks/review, merge the PR, import latest main into Readdy and publish.
Retest with explicitly labelled controlled client/job/guard fixtures: populated
inbox, missing job, refresh/focus, Retry, accept/replay/decline and account changes.
No production invitation, email, bell, application, decline, message, booking or
payment was created/changed for this repair. PR #193 is separately merged with a
passing GitHub build; its publication and actual bell/mailbox delivery remain
unconfirmed. This inbox repair does not certify the full guard journey or launch.
