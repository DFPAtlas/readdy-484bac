# QuickGuard → DFP Command: secure support synchronisation (Stage 1)

## What this branch implements

Adds `dfp-support-approved-message-worker`, a dedicated **service-only** Edge Function that forwards **already approved customer-visible client ticket messages** to the existing DFP Command receiver. It reuses the established HMAC-signed `receive-support-message` contract and per-message sync status. It is intentionally NOT a direct Resend-webhook-to-DFP integration.

**Status: code staged in a PR; no Supabase deployment, cron, email DNS, webhook, automatic reply, or DFP Command changes.**

## Security boundaries

- Calls require the server-side Supabase service-role bearer token. `verify_jwt=false` on this worker is permissible ONLY because its handler verifies that token itself; never expose it to a browser. Deploy and invoke from a trusted backend only.
- Resolves `messageId` server-side and checks the message belongs to a non-deleted client ticket, has `sender_type=client`, and has `is_internal != true`. Never forwards inbound review notes or guard tickets.
- Requires `support_tickets.dfp_sync_status=synced` and an assigned DFP ticket number; no auto ticket creation.
- Signs the upstream payload using existing `DFP_SUPPORT_BRIDGE_SECRET` and `DFP_SUPPORT_BRIDGE_KEY_PREFIX`; no credentials go in the frontend.
- Reuses `ticket_messages.dfp_sync_status` for retry visibility. DFP receiver MUST enforce deduplication by siteSlug and quickguardMessageId.
- The existing client-facing `dfp-support-message-bridge` remains unchanged.

## Deployment prerequisites

1. Resolve Resend 401 signature errors and verify `support_inbound_emails` staging, without changing live routing.
2. Validate DFP Command receiver contract and uniqueness rules, including repeated nonce and repeated message ID.
3. Verify linked inbound email creates **internal-only** note via admin review; an explicitly approved/public message must be created by a *separate*, audited action with verified ownership and sender authenticity. This PR does not implement that approval.
4. Test worker on a non-production project with service-role auth, invalid auth, internal note, guard message, deleted ticket, unsynced ticket, already-synced message, upstream failures, replays, and retries. Run type checks and CI.
5. Only then deploy with `verify_jwt=false`, restrict invocation to a trusted backend/scheduler, and invoke for individually approved client messages. Never invoke directly from Resend or an email body.

## Next stage (not included)

Build a durable transactional outbox that records approval and DFP sync intent atomically; service worker claims due records with leases, exponential backoff, bounded retries, and a dead-letter dashboard. DFP Command should ingest minimal ticket metadata first and access sensitive content only according to role. Add explicit per-app tenancy and source IDs before onboarding BuildNerve, GarageFlow, GuardianHub, or Vowora.

## Rollback

Do not schedule/invoke the new worker. The existing bridge and all existing live email routing are unaffected. If deployed later, disable the worker invoker; no schema or data rollback is required by Stage 1.
