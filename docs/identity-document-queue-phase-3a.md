# Identity document queue Phase 3A

This change is for review and isolated validation. Keep the production worker off. The SIA licence service and HAL monitoring workflows use independent deployment paths.

## Production baseline

The read-only schema audit found a partial unique index for one open check per guard, a legacy claim RPC with row locking, and a trigger that copies legacy advisory results onto the guard. The legacy claim RPC does not recover abandoned claims. Production queues contain neither immutable object references nor submission IDs. The private bucket returns version, owner, object ID and ETag metadata. The deployed guard approval handler requires an active admin with AAL2 and a recorded reviewer. The identity worker must not inherit the running SIA worker's service-role configuration.

## Changed contract

| Surface | Design |
|---|---|
| Queue table | Nullable submission version, owner, proof and licence references, next available time, lease owner/token/expiry and completion fingerprint. Existing jobs and columns are retained. A database trigger rejects changes to a captured guard, owner, submission version, object reference or checksum, including service-role updates. Replacement files create a new submission. Partial indexes support pending and expired checks and duplicate digests. |
| Guard table | Server-owned current document submission version. Path changes and storage overwrite or deletion invalidate prior advice. Only completion for the still-current owner, version and object revisions updates guard advice. |
| Enqueue | The authenticated Edge Function verifies the caller's guard ownership. It computes SHA-256 over both objects and then calls a service-only RPC which rechecks the exact owner, storage revision and guard pointers. The guard row serializes equal submissions and supersession. Legacy open rows are allowed to finish first; v2 never claims a legacy row. |
| Claim and completion | Authenticated worker RPCs require a registered enabled user. Claims lock the guard row with SKIP LOCKED, mint a fresh 10-minute lease, and increment attempts. Retry delays are 30 and 60 seconds. Expired claims are eligible for reclaim and the third exhausted claim becomes a manual-review result. Completion checks the current token and authenticated worker, rejects stale or changed submissions, and replays an identical response without another update. |
| Storage | The worker presents its own access token and lease to the download function. The function checks scoped access on either side of its download and verifies the captured SHA-256. It never accepts an object path supplied by the caller. The worker has no direct queue, guard, SIA, admin or Storage access under the added restrictive RLS policies. The service key remains server-side. |
| Human approval | The migration does not write eligibility, verification status or reviewer fields. An identity worker cannot also be registered in the approval endpoint's admin table. A clean model result is routed to human review. Human approval code and provenance triggers are unchanged. |
| Worker readiness | Liveness is a periodic process marker. Readiness requires successful schema-qualified PostgREST access, a private-bucket check through the broker and a successful claim RPC, including an empty queue response. This does not assert model accuracy or access to any real document. |

The checked-in worker reuses the recovered parsing and document rules. It uses an approved local model URL, a Supabase publishable key and a rotating dedicated worker Auth access token file. Configure automatic token refresh outside the worker and atomically replace that file. Deploy with restrictive network egress and an approved protected link to the inference endpoint. Never put a service-role key in its environment.

The existing request route remains compatible when the new server flag is unset. The wizard asks for v2 after saving and explicitly receives a skip while `IDENTITY_QUEUE_V2_ENABLED` is off. Existing converted guards must use the versioned route. A failed request does not undo a saved profile. Operators should confirm submission retry or reconciliation for enqueue failures before activating a consumer.

## Isolated validation

Run `bash tests/identity-queue/run.sh` with Docker. It starts an ephemeral, network-disabled PostgreSQL container, applies a synthetic reproduction of the audited legacy surface and then tests the migration and fail-closed rollback. The database tests cover simultaneous claims, duplicates, in-flight reupload, crashes, expired claims, already-expired and superseded completions, immutable references, prior audit and queue history, permissions, cross-account references, idempotency, and preservation of approval controls. The Python adapter tests use synthetic JWT text and a mocked HTTP transport. No real storage objects are touched.

Before production approval, exercise the exact Supabase Auth, PostgREST, Edge/Storage and signed-user stack in a separate staging project. Confirm Storage owner and version metadata on fixture uploads, token refresh, broker checksum mismatch behavior, and real review UI outcomes. Neither vision model qualified in Phase 3. Model acceptance, exact-version human attestation, retention and protected inference transport are separate release gates.

## Deployment and rollback

1. Export production schema/grants and the deployed request bundle; record timestamps and SHA-256. Recheck production schema drift and compare available Storage extensions. Schedule the migration after reviewing index lock time. No production execution is authorised by this PR.
2. After deployment approval, apply the migration with the worker off and the v2 flag unset. Deploy the broker and request functions. Verify existing legacy paths before enabling the v2 enqueue flag. Provision the dedicated worker identity only after the staging acceptance checks.
3. To roll back, stop only the identity worker and unset `IDENTITY_QUEUE_V2_ENABLED`. Apply [the fail-closed rollback SQL](identity-document-queue-phase-3a-rollback.sql) to disable worker accounts and revoke v2 RPC access. Restore the previous request bundle if needed. Keep the additive schema and all queue, audit and digest evidence. Existing v2 submissions remain fenced. Authorised reviewers handle converted guards manually until reactivation or a separate reviewed legacy reconciliation.
4. Verify a normal legacy enqueue/claim cycle with staging fixtures, and confirm that v2 authentication is denied and queued rows are retained. Re-enabling requires restoring the migration's grants explicitly and approving workers again. Do not drop the version columns or queued evidence as part of an emergency rollback.
