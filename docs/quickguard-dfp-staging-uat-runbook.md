# Isolated UAT runbook: QuickGuard → DFP Command unverified email intake

## Environment gate
No dedicated staging project was found among the connected Supabase projects on 29 October 2026. Do NOT apply these draft migrations to QuickGuard or DFP production. Provision two isolated staging projects (or separate isolated local Postgres instances), with synthetic data and dedicated credentials. Obtain approval for any nonzero Supabase project cost before creation.

## Order of operations
1. Apply the minimum prerequisite schemas to isolated staging: QuickGuard inbound emails and DFP support site registration. Do not copy production PII or secrets.
2. Apply DFP PR #12 migration `20261029213500_unverified_email_intake.sql` and QuickGuard PR #112 migration `20261029215000_support_email_dfp_outbox.sql`.
3. Deploy `receive-unverified-support-email` to DFP staging with `verify_jwt=false` (request HMAC is mandatory), using a **staging-only** 32+ character signing secret.
4. Deploy `forward-quickguard-support-email` to QuickGuard staging with a staging-only DFP receiver URL, the matching signing secret and `verify_jwt=true` or a rigorously verified service-only handler. Keep `QG_DFP_EMAIL_FORWARDING_ENABLED` unset until tests.
5. Inject one synthetic inbound email into the QuickGuard staging inbox. Enable the forwarding flag **only in staging**, invoke the trusted worker, and verify exactly one DFP intake row and one QuickGuard outbox row marked delivered.
6. Replay the same provider email ID, change the payload for replay, and issue concurrent worker runs: no duplicate intake; existing content must not be overwritten.
7. Test wrong HMAC, missing signature, timestamps ±6 minutes, malformed sender/recipient, disabled source, overlong body and database failure. Ensure every rejection makes no DFP write.
8. Simulate DFP timeout after successful commit, network outage, crash after claim, and repeated retry. Verify 2-minute lease expiry recovery, capped backoff, no email loss, and idempotent acknowledgement.
9. Verify anon and authenticated roles cannot access intake or outbox; verify staff-only review path before UI release. No outbound reply or customer-visible message should result.
10. Disable staging forwarding. Do not enable production until a reviewer signs off persistence, privacy/retention, permanent-failure handling, and alerting.

## Required evidence
Record test ID, request timestamp, synthetic provider ID, HTTP response, QuickGuard outbox status/attempts, DFP intake count, no customer-visible ticket, and rollback result. Keep credentials and raw email content out of logs.

## Known blockers before rollout
- DFP Command's new intake table currently has no operator UI. Inbox storage alone does not place a ticket on the existing support board.
- The QuickGuard worker needs bounded dead-letter handling and atomic acknowledgement protected by lease ownership; delayed workers must not overwrite newer claims.
- Add alerting and retention policy before production.
- No automatic forwarding job/cron exists. Deployment alone does not start forwarding.
