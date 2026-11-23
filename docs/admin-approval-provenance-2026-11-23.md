# Preserve approval provenance on retries

An approval retry for a guard already marked `approved` or `verified` used to fill a missing `verified_by` with the current admin and replace `verified_at` with the retry time. The deployed v77 source exactly matched the repository before this change. A normal/override retry is not evidence of the original decision, and that automatic write could conceal a missing-reviewer exception.

The already-approved branch now returns HTTP 409 with `APPROVAL_REVIEWER_MISSING` when no reviewer is recorded. Its error explains that an authorised provenance review is required and that no approval data changed. It returns the exact guard/status for diagnosis, without a successful approval acknowledgement. This happens before any guard/user update, email, notification, referral or promo side effect. The override request does not bypass it.

When a reviewer is already present, the existing HTTP 200 `already_approved=true`, `notification_status=not_requested` response remains; that path performs no writes and preserves the original reviewer/timestamps. New decisions still require an active human admin with MFA, record that reviewer, and use the existing separately reported email result. Service callers cannot approve. No manual SIA, rejection, suspension, restore, billing or entitlement path was changed.

PR254's published frontend already displays the new server error and leaves the review open. Tests execute its actual normal/override handlers to confirm the conflict cannot close or refresh the review or claim saved approval. No frontend change or Readdy publication is needed for this backend-only repair.

## Validation

- A regression against the old source returned 200 instead of the required 409, reproducing the fault before the repair.
- Actual Edge-handler tests cover approved/verified records, normal/override requests, unchanged existing-reviewer retries, service refusal and fresh human-reviewed approvals. Missing-reviewer requests produce no writes or outbound requests.
- Frontend handler tests confirm the error stays visible in both flows without closing/refetching the review.
- Full regression suite, TypeScript/admin type checks, lint and strict Edge-source checks are recorded with the delivery report. No frontend production build is required because frontend source and dependencies are unchanged; GitHub's ordinary build workflow remains the merge gate.

## Existing production exceptions

The 23 November 15:12 SIA snapshot still reports eleven warnings and five other incidents, including missing reviewer/document evidence and the controlled Basic fixture's historical licence mismatch. Read-only inspection confirms three approved/verified profiles without a recorded reviewer. This repair preserves those records for proper review. It does not invent a reviewer, date, licence result or document, change eligibility, or declare those exceptions resolved. The Basic sandbox billing fixture and its distinct Stripe identities remain intact.

The positive documented synthetic approval/email delivery test remains open. Do not force an incomplete production guard through approval to test the new guardrail. Existing authorised test-email recipient and isolated recovery target remain unchanged.

## Deployment and rollback

Deploy only `supabase/functions/admin-verify-guard/index.ts`, retaining JWT verification. Compare the full deployed file with tested source. Before/after read-only hashes of guards, subscriptions and subscription payments, approval-email count and missing-reviewer count must be retained; no production approval should be submitted for this deployment check.

The pre-repair source is available at main commit `a245e33bd7a47b9d3b2e83702816e92af6b96802`. Rolling back would restore the reviewer-backfill defect, so deploy it only for a confirmed regression following review. No database migration, data rollback, key or dependency change is needed.
