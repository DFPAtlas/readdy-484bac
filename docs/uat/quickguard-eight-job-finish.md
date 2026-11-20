# QuickGuard: eight-job finish PR

Baseline: `3bb4097cde0ec334d1a3e6b0e7cc05328be04408` (main, 20 November 2026).

This PR implements QG-R01 through QG-R08 from the fixed code repair backlog. Source completion and local/CI verification do not mean production acceptance has already occurred.

| Job | Result | Main regression evidence |
| --- | --- | --- |
| R01 Authentication | Retire old identity/profile/route requests; use the authorized admin RPC; expose bounded verification and Retry; inactive accounts have a stable account-status page. | `quickguard-finish-auth-ui.test.cjs`: sign-out, A→B, old route hydration, lookup failure, token refresh, inactive Support exit. |
| R02 Guard actions | Bulk Invite calls the existing authorized invitation RPC. Message uses the new atomic message RPC. Count confirmed targets, retain failures, reuse stable operation identities. | `quickguard-finish-helpers.test.cjs`: invitation calls, partial receipts and lost-reply message retries. |
| R03 Message reads | Complete owned history and unread totals; pair/job filters precede paging; stable `(created_at,id)` history cursors; visible load/read errors and scoped realtime refreshes. Minimal peer contact RPC replaces broad private profile reads. | Helpers: 405-row history, tied timestamps, foreign/malformed/failed pages. Existing lifetime tests: changing chats and late results. |
| R04 Message writes | Drafts clear after confirmed save; bounded, identity-scoped sends/read/unread/delete use exact acknowledgements, partial results and locks. All existing client/guard message entry points use the shared RPC. | Composer UI, helper acknowledgements, database ownership/RLS, lost reply, notification rollback and unmount cases. |
| R05 Support | Stable ticket creation, required job/refund validation, confirmed owned closure, deterministic closure notice, persistent central-sync recovery. | Actual modal retry/warning UI; database create/replay/foreign validation and owned closure tests; existing support recovery suite. |
| R06 Notifications | Service-only canonical writer uses real columns and recipient auth IDs. Message/transaction/selection/application notifications commit with their originating database record. Existing categories/priority normalize to the same values used by display and filtering. Cancellation/refund/subscription/payout writers check service RPC results. | Database recipients, RLS, preferences, dedupe, silently dropped insert rollback; service helper rejects malformed acknowledgements. |
| R07 Reviews | One service RPC commits review, published-only rating aggregates and job state together. Unchanged retry reconciles existing partial reviews and returns saved state. Moderation remains hidden. | Database job/rating rejection and zero-row rollback, replay, multi-assignment completion; actual modal retry/unmount; endpoint delegation/error mapping. |
| R08 Closure and retention | Closure detaches owner/member links immediately and advances affected owner revisions. Private snapshots retain team audit until profile retention; the existing retention worker clears closed-owner team state/receipts/snapshots subject to holds. | Combined migrations plus the actual existing `finish_account_retention_task` function in isolated PostgreSQL fixtures; membership release/reassociation, hold and unrelated-member preservation. |

## Deployment order

Use one coordinated release window. The new restrictive message policies require the new frontend RPC paths: keep message mutations unavailable to users during the backend/frontend transition.

1. Apply the three migrations in order:
   - `20261120170000_quickguard_finish_writes.sql`
   - `20261120170100_quickguard_team_closure.sql`
   - `20261120170200_quickguard_payment_notifications.sql`
2. Refresh the PostgREST schema cache if the migration runner does not do so. Verify authenticated access to `send_owned_job_message`, `change_owned_job_messages`, `get_my_message_partners`, `create_client_support_ticket` and `close_client_support_tickets`. Verify `emit_user_notification` and `submit_client_review` remain service-only. Retain existing invitation RPC grants.
3. Deploy `create-review`, `enhanced-stripe-webhook`, `send-cancellation-notification`, and `send-refund-notification`, including their shared modules. The unchanged account-retention worker uses the new database triggers; it needs no redeployment.
4. Merge/import/publish the frontend from this PR, then reopen message mutations. Do not publish the dependent frontend before the backend is ready.
5. Run one planned acceptance pass with controlled test identities and sandbox payment records. Confirm R01–R08 outcomes, deployment versions and retry states before closing their live acceptance status.

Migration installation normalizes existing notification categories/priority and reconciles memberships for accounts **already** closing/closed. It does not create a new message/invitation/ticket/review, close another account, or request a payment/refund/payout. It does not backfill historical financial notification events.

If rolling the frontend back, first coordinate removal of the three `qg_messages_confirmed_*` restrictive policies so old clients can write again. Keep the new backend functions and audit/retention data; do not discard saved receipts or undo legitimate user records as a rollback mechanism.

## Operational behavior

- A timeout means the outcome is uncertain. Retry with the retained operation identity/details or reload authoritative records. A request timeout cannot undo an already committed database or provider operation.
- A QuickGuard ticket closure is local. The existing central-support API accepts intake and messages, not remote status changes. Its deterministic closure notice is retried through the message bridge; central staff own the central ticket status. Pending notice synchronization stays visible in the closed ticket drawer.
- In-app notifications are idempotent by source event and recipient. Existing email/push delivery behavior is retained; this PR does not claim exactly-once external email/push delivery. A notification trigger failure rolls back the database transition and leaves the existing operation/webhook retry path responsible for reconciliation; it cannot roll back an external Stripe action.
- Team snapshots and the closed owner's operation receipts follow the existing profile-retention deadline and legal hold. A surviving owner's independent team operation receipts remain under that owner's retention policy. Member accounts and financial records are preserved.
- Database fixtures use real PostgreSQL behavior via PGlite. The team entry-point fixtures cover the new lock injection; the existing team-management suite covers the underlying team authorization/revision rules. The real retention completion function is executed in the new fixture. Hosted concurrency and external integrations remain part of deployment acceptance.

## Verification

Required gates: repository TypeScript, admin/financial type gate, repository lint, complete unit/regression suite and production build using a local placeholder Supabase URL. GitHub Build Check repeats these gates on the PR head. Test traffic does not contact production Supabase, Stripe, email, central support or real users. Validation does not deploy this PR.
