# Secure replacement request submission

## Confirmed problems

The form inserted a replacement request, optionally created/routed/linked a ticket, inserted a notification and updated assignment flags through separate browser writes. It ignored several returned errors, could offer a fresh submission after an uncertain partial save, and closed automatically before showing follow-up failures.

Read-only production metadata confirmed that customer policies allowed INSERT, UPDATE and DELETE on any replacement row owned by the client without validating its job/assignment relationship or protecting lifecycle status. The assignment table permits customer reads but does not permit customer updates. There is no replacement-request trigger or existing submission RPC connecting these writes. No claim is made about historical misuse.

## Repair

The authenticated `submit-replacement-request` Edge Function takes the user identity from the verified bearer token. It maps an explicit parameter list into a service-only, `SECURITY INVOKER` database transaction. Body user/guard/status fields cannot become authoritative.

The transaction verifies an open client account, ownership of a non-deleted job, the affected assignment's job and its actual guard, allowed reason/urgency, lengths, emergency contact and future UK arrival. The database derives the affected guard and job title. UK wall times are normalised to a UTC timestamp string, including BST, and nonexistent clock-change times are rejected. A completed/cancelled/refunded job cannot start a new request; confirmed receipt replay does not reapply writes or reset later status.

One transaction saves the request, optional pending support ticket/link, assignment issue/replacement flags and client notification. A failure in any stage rolls back all of them. Same-job row locking serialises submissions. Repeating a request ID with matching details returns its original receipt/ticket without another notification or flag update; changed details for that ID are rejected. Different, intentional request IDs remain distinct requests.

The migration preserves customer SELECT and closed-account restrictions, removes customer direct-write policies and table/column write grants, and grants RPC execution only to `service_role`. It enables RLS explicitly. It does not rewrite historical rows, widen assignment access, grant customers service execution or use a privileged definer function. Existing service administration and retention access remain available.

After commit, the Edge Function attempts the existing idempotent Command Centre bridge with an eight-second timeout. A bridge failure returns the saved receipt with synchronisation pending. The ticket remains pending for the existing bridge sweep, which includes pending/failed/unset tickets. No bridge call occurs inside the SQL transaction.

The form locks duplicate clicks and retains one request ID and immutable payload for uncertain retries. Definite validation/permission rejection permits correction with a new ID; uncertain outcomes or ID conflicts preserve the original intent. It validates a matching receipt, retains notes on failure, displays a durable confirmation and pending-sync notice, and finishes only on Done/Close. A keyed modal and lifecycle cleanup retire old callbacks. Existing unsupported replacement-time/call guarantees are replaced with availability-qualified wording. Preferred candidate details remain advisory notes; this does not book that candidate or alter any payment fields.

## Validation and limits

Isolated PostgreSQL tests reproduce direct status forgery before the migration and verify denied browser mutations/RPC execution, independent column grants, owned reads, closed/foreign owners, foreign assignments, invalid inputs, terminal jobs, UTC/BST handling, one complete save, replay/mismatch handling, no-ticket paths and rollback after late notification/assignment failures. Migration reapplication and transactional DDL rollback are exercised. Browser/helper/handler tests cover stable retry IDs, corrected rejections, duplicate clicks, retained notes/receipts, explicit acknowledgement, unmounts, verified actor derivation and bridge success/failure without losing the receipt. The existing shared bridge regression now checks the server route.

The 35 targeted tests passed. Full-suite, frontend/endpoint TypeScript, admin/financial checks, lint and production-build results are recorded in the PR. Endpoint type checking supplies ambient declarations for Deno/remote imports. Tests use an isolated PostgreSQL fixture or mocks; the build uses loopback Supabase placeholders. Production schema, privilege/trigger metadata, advisories and relevant log aggregates were read only. No live request, ticket, notification, email, payment, grant or schema change was made during this repair.

This verifies logic and a production-shaped fixture, not the deployed transaction with every production trigger. Live signed-in UAT and hosted migration verification remain outstanding. Existing requests were not audited or rewritten. Idempotency follows one submission intent; opening a new modal creates a new intent, so users with an uncertain result are asked to check the job before starting another request.

## Deployment

After review, green GitHub checks and merge, use one deployment window:

1. Deploy `submit-replacement-request` to QuickGuard project `vnywjfpkepjgclkbcmsj` with the committed JWT configuration; the function authenticates internally. Include the existing support bridge configuration.
2. Apply `20261118215349_secure_client_replacement_submission.sql` and verify RPC/service grants, RLS and owner-scoped reads. Re-run security advisors.
3. Import latest main into Readdy and publish. Reload existing browser tabs; the old form cannot insert directly after hardening.
4. Use approved test accounts/assignments to test a normal request and urgent request with a ticket, receipt replay, rejected ownership, and the support-pending state. Verify one request/ticket/notification and confirmed assignment flags; check the tracker after reload. Submitting an urgent test can invoke the real Command Centre bridge and should be an explicitly planned UAT action.

Production remains unchanged until deployment. Migration/endpoint/frontend must be treated as one repair; reverting only to the old browser form would leave that form unable to submit. Transactional DDL rollback was rehearsed locally; existing data is preserved by the migration.
