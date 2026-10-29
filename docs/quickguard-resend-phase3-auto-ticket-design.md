# QuickGuard Resend — Phase 3: automatic ticket creation and replies
Status: design and tests only. **No production actions**, no auto-publishing, no DNS changes. This proposal must be rebased after PR #107 is merged and its security gates pass.

## Architecture and gates
1. Inbound `email.received` events go through the existing verified webhook and private `app.support_inbound_emails` table. Never trust event body, From address, Reply-To, subject ticket reference, or display name as ownership evidence.
2. Background worker reads staged mail with service credentials. Record processing attempts and bounded retries, using `resend_email_id` for dedupe and `internet_message_id` + `In-Reply-To` and `References` for **thread suggestions only**.
3. Identify possible client or guard records by normalized email. This is **not** proof of sender control. Check DMARC/SPF/DKIM authentication results from a trusted ingress provider where available, then obtain stronger verification where required (signed logged-in link or challenge); never let an authenticated-looking email reveal ticket contents.
4. If one verified owner has an unambiguous matching ticket, link the email using a transaction and unique inbound ID; otherwise leave `pending_review`, including unknown external senders and ambiguous matches. Ticket reference is advisory only. Retain full audit history.
5. For a verified new enquiry, create a support ticket with an explicit client_id or guard_id and valid required fields. Unknown senders require a separately modelled external-contact case; don't invent a client/guard ID. Reuse current category/status constraints and route client tickets via an authenticated **service-safe** DFP bridge, never a user's JWT.
6. For replies, create a **new** outbound queue item atomically with the ticket response, apply idempotency key `ticket:{ticket_id}:message:{message_id}`, and deliver via Resend using a configured QuickGuard sender. Record provider response, message ID, delivery/bounce status, and retry safely.
7. Stamp outbound replies with `Message-ID`, `In-Reply-To`, `References`, and a non-secret ticket reference to aid threading; use secure reply tokens only if genuinely needed, hashed at rest with TTL and revocation. Never treat these alone as authorization.
8. Prevent mail loops: ignore auto-submitted/bulk messages, suppress notifications to no-reply and known bounces, cap message size and rate, quarantine unsafe attachments, sanitize HTML, and apply retention/deletion rules.
9. DFP Command Centre synchronisation is asynchronous, with own outbox and unique IDs. A DFP outage must not cause duplicate customer emails or tickets.

## Proposed DB migration (not implemented)
- `app.support_inbound_emails`: nullable verified_actor_kind/id, provider_authentication metadata, candidate ticket reference, review_reason, processing_attempts, next_attempt_at, resolved_at.
- `app.support_email_threads`: ticket_id, inbound_message_id, outbound_message_id, direction, unique provider IDs.
- `app.support_outbound_email_queue`: ticket_id, ticket_message_id, recipient, template, payload, idempotency_key unique, status, retry_count, provider_message_id, last_error.
- `app.support_email_audit`: actor/admin ID, action, inbound ID, ticket ID, timestamp and outcome.
Do not create the above until live schema constraints and supported Supabase migration order are verified.

## Acceptance tests
- Existing client and guard: verified matched first email, verified reply, new ticket, duplicate provider event and concurrent retried event.
- Unknown sender, spoofed From, different ticket owner, copied or forged reference, missing authentication data, ambiguous owner.
- Database insert failure, worker crash after send, delayed/out-of-order replies, email provider outage, DFP outage and eventual retry.
- No ticket leakage over RLS; no privilege gained by subject/reply headers; no public message from unverified sender.
- No double ticket or double outbound email after retry; provider delivery and bounce callbacks update status exactly once.
- Automated email and security regression tests run in CI; isolated staging test uses an actual Resend receiving inbox and test identities.

## Cutover and rollback
- Prepare templates, sender identities and webhook routing in staging. Audit FastHosts mailbox exports and retention before MX changes.
- Deploy migrations/functions with sending disabled, run UAT, then enable under a server-side feature flag and observe queues.
- Switch MX only once Resend receiving and admin processing are verifiably functioning. Leave rollback MX values documented and do not cancel FastHosts before acceptance.

## Relationship with PR #107
PR #107 provides the authenticated human review screen and must pass authorization tests, database integration checks and the build. This Phase 3 proposal makes no assertions that PR #107 is ready, merged or deployed.
