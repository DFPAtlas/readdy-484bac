# Guard approval and document review · Phase 3D

## Audit and staged design

The read-only production catalogue showed the existing admin approval provenance trigger, closed-account guard, guard-to-user sync trigger, and active super-admin role. The current Edge approval path used AAL2 but accepted approval without versioned document evidence. The legacy verification, accounts, and subscribers screens also contained direct status updates. The new database trigger gates all writes that grant or restore approved access, including direct table and service-role paths. Those legacy UI actions lead to the canonical guard review.

The applicant wizard enqueues after the server confirms a saved profile and after document reuploads through that wizard. A failed request leaves the profile saved and exposes an idempotent retry from onboarding. Admin preparation also recovers a missing current snapshot. The Phase 3A enqueue contract still permits only one open check and appropriately supersedes old versioned checks. Resolve any outstanding legacy claims before enabling staged versioned review for affected guards.

The admin uses the existing Documents tab. Cards show submission version, advisory result, uncertainty reasons and per-document access. They handle unavailable, working, retry and manual-review states. Requesting more information, rejecting, SIA review and document-based restoration remain administrator actions. The AI worker can stay off while current documents are prepared, inspected and attested.

## Review and approval security

- The canonical review requires a verified Auth session, AAL2 and an active administrative role. The worker identity is excluded explicitly. The browser uses a reviewer-owned review ID; it does not supply a storage path or checksum.
- A private review row preserves the exact proof/front/back object ID, storage version and SHA-256, including the queue's submission version. A checksum-verified broker records access to each slot before delivering bytes with no-store. Owners keep scoped reads to their own folder. Non-owner authenticated reads of the identity bucket go through the broker. Ancillary tools that previously signed identity-bucket links must use the review flow.
- An attestation requires recorded access to all three current slots. Approve and restore serialize on the guard and lock the referenced objects with NOWAIT, avoiding stale results and reverse lock waits. A concurrent storage or pointer change either serializes after approval or invalidates/fails the review. Replacement leaves historical audit events intact and prevents new approvals using the old attestation. Existing active approvals are not revoked by the migration.
- Review and approval audit rows identify reviewer, timestamp, guard, event and submission version. Approvals that are replayed do not insert a second decision or trigger duplicate notifications through the normal Edge flow. The database still enforces the existing closed-account guard. The reviewed RPC controls eligibility; existing Edge-side notifications and other existing side effects remain in the normal wrapper.
- The model output is advisory. No queue result records a human attestation or grants final approval.

## Validation and rollout gates

Run `bash tests/guard-document-review/run.sh` against an ephemeral network-disabled PostgreSQL instance. Run `bash tests/guard-document-review/run-browser.sh` with Playwright Chromium installed for the synthetic card UI and broker-response fixture. Production tables are never used by those tests.

Before release, validate exact Supabase JWT, Edge, Storage metadata and policy behavior in a separate staging project, including the three documents in a single review, object replacement, legacy queue backlog, entitlement notifications, reviewer-only restoration and authentic mobile PDF readability. Decide ownership for retention, legal holds and audit access. Complete the Phase 3A–3C operational gates, including credential renewal, approved protected transport and model pinning. No deployment or worker activation is approved by this draft.

## Rollback

Before deployment, archive the Edge bundles, relevant policies, triggers and grants and record checksums. Roll back the UI and broker separately only with final approval paused. Keep the database fence, exact review references and audit tables. Suspend fresh attestation and reviewed approval RPC access with the fail-closed script; existing approval history persists. Restore the preceding UI and bundles only if their approval controls are disabled or clearly direct reviewers to the supported route. Re-enable the authenticated RPC grants only with the matching UI and broker after staging verification. Do not revert to direct guard approval, remove the audit tables or restart the SIA service. The Phase 3A queue rollback remains separate.
