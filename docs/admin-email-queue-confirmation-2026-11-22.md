# Admin cancellation and refund email confirmation — 22 November 2026

The live `process-email-queue` v39 treated an HTTP 200 from the cancellation/refund notification endpoints as success and ignored the result of `complete_email_queue`. Those endpoints can return 200 with per-recipient errors, an empty results array, or no provider message ID. Queue rows could therefore be marked sent without acceptance evidence. Missing event metadata could also fall through to the generic placeholder email path.

The repaired worker requires a matching cancellation/refund ID, success=true, a nonempty result set with a client result, unique supported recipients, a nonblank provider message ID for each result, no recipient errors, and a true completion RPC acknowledgement. Provider acceptance still does not prove inbox delivery.

On partial, failed or unknown delegated outcomes, including HTTP/network/JSON errors and uncertain queue completion, the worker records an event-specific reconciliation error and leaves the claimed row processing. It does not call `fail_email_queue`: that RPC automatically resets retriable rows to pending and could resend an already accepted recipient's email. The deployed claim RPC selects only pending rows. Missing event IDs are also held for review without a send.

## Operator recovery

Review `email_send_log` entries with template `cancellation_notification_reconciliation` or `refund_notification_reconciliation` and the corresponding queue ID. A processing row is not proof of delivery. Check the actual sender/provider logs for each intended recipient before taking action. If the completion RPC response was lost, read back the row before changing anything: it may already be sent. Never requeue the entire event after a partial send without recipient-specific reconciliation. Preserve the original cancellation/refund and payment records; this repair changes no money movement or booking decisions.

The direct notification endpoints remain unchanged. A manual call to one of them is not made idempotent by this worker change. Automatically retrying a whole delegated event remains unsafe until recipient-specific deduplication is implemented; this patch routes uncertain cases to review instead.

## Validation

Five focused handler tests reproduce the original false-completion and unchecked-RPC failures and cover both event types, empty/malformed/mismatched/partial results, HTTP and network failures, invalid JSON, completion false/null/error/throw, successful client-only and client-plus-guard sends, missing event metadata, worker authentication, and no automatic resend on the next queue pass. All fetches are synthetic; no real email or payment action is invoked.

## Separate monitoring findings

The five current failed queue records are `email_system_e2e_test` messages from **2 October 2026**, exhausted at one attempt after an unverified-domain error. They were not replayed or relabelled as delivered. Today's separately authorised rejection email has independent provider-delivery evidence in the admin operations report.

The Review & Reputation agent (`8M4HAkmigFxAH7ck`, agent ID `qg-review-reputation-agent-v01`) reports rating/count drift for guard `20826398-1bcf-4a93-9b61-493c3e156610`. The only review, `21633a4d-6d27-41d4-8bb6-a23d1b3e0864`, is hidden; its rating is 5 while the guard's published aggregate is correctly 0 with 0 published reviews. HAL reasoning needs to aggregate only published reviews, while retaining unfiltered reads for moderation/duplicate checks where appropriate. Do not publish the hidden synthetic review or write the guard's aggregate to clear the warning. Verify the live workflow export and the database aggregate rule before patching its reasoning. Add hidden-only, mixed hidden/published, genuine published-drift and read-error fixtures, then inspect a normal scheduled snapshot. Five closed, unassigned adverts were also intentionally retired earlier; a review should not be demanded merely because an unfulfilled advert was closed.
