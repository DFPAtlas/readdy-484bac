# QuickGuard Resend inbound support integration — staged rollout
**Status:** development only; do not merge/deploy until tests and receiving API verified.

## Workflow
1. Verify the Resend/Svix signature using the raw POST body. Never trust email content or sender identity as authority.
2. Retrieve plain text through Resend, store in `app.support_inbound_emails` with a unique provider ID; acknowledge duplicate retries.
3. **Manual triage only** until authenticated admin actions are built. Match candidates by an explicit ticket reference, then validate ticket ownership and sender on the server. Unmatched emails remain pending.
4. For approved messages: atomically create one `app.ticket_messages` record and link the staged email. The client/guard must not see unverified content.
5. Sync client messages to DFP Command via a service-safe idempotent bridge; existing `dfp-support-message-bridge` requires an authenticated client JWT, so it CANNOT be called directly by the inbound webhook.
6. Implement controlled outbound replies, deliverability logs, threading IDs, attachments quarantine, spam/rate limits, and retention.
7. Keep current shared Resend webhook and FastHosts/DNS unchanged until production routing passes end-to-end tests.

## Required UAT
- Known client and guard, unknown sender, forged sender, impersonation and spoofed ticket reference
- Fresh email, reply to ticket, repeat event, out-of-order message, webhook signature failure
- Duplicate delivery, malicious HTML, oversized body, attachments, auto-replies/loops
- DFP bridge outage and retry, customer-visible RLS, admin response and email deliverability

No automatic ticket creation, AI agent actions or outbound replies should be turned on by this draft PR.

## Stage 2 committed — reviewed, internal-only ticket attachment
- Migration `20261029133000_resend_support_triage_stage2.sql` adds `app.triage_quickguard_support_email(inbound_id, ticket_id)`.
- Service-role-only; callers MUST authenticate a real admin separately and check sender identity, claimed ticket ownership and content before invoking it.
- Locks the staged email, checks it is pending and the ticket exists, atomically inserts a uniquely linked **internal** ticket note, then marks the inbound row linked. Replays return the existing note ID.
- Does not create public customer/guard messages or new tickets, does not send emails and does not trigger DFP synchronisation. No live changes.
- Before production, add the authenticated admin triage API/UI, association verification, integration tests on an isolated Supabase database, and explicit published-message + DFP bridge workflows.
