# QuickGuard → DFP Command outbox worker: validation gates

**Draft only.** The new `forward-quickguard-support-email` is disabled unless `QG_DFP_EMAIL_FORWARDING_ENABLED=true`. Do not deploy or enable until DFP Command PR #12's receiver, table, and matching secrets are tested in staging. Never expose service-role credentials to browsers.

The worker stages all `pending_review` emails idempotently. `claim_due_support_email_dfp` atomically claims up to five messages, using row locks to avoid concurrent claims, recovers expired two-minute leases, and records delivery, failure and exponential backoff. It sends an HMAC-signed JSON payload to the dedicated unverified receiver. **Do not change QuickGuard's original inbound review status or forward to the existing customer-visible support message endpoint.**

Required UAT: verify HMAC payload matches receiver byte-for-byte; wrong secret and stale timestamp rejected; duplicate provider IDs accepted once; parallel workers cannot claim the same job; interrupted worker lease eventually recovers; failure after successful upstream commit retries idempotently; missing staged email reports failed status; DFP outage increments retry; malicious content remains restricted; QuickGuard admin review still works; no outward email or customer ticket becomes visible; no data loss or duplicates.

Outstanding before production: add alert/dead-letter path, bounded permanent failures, retention rules, sender-spoof/auto-response filtering, staff-only central inbox, and actual isolated staging tests. Both repos must agree on secure credential provisioning and receiver URL. Production settings and cron must remain off until UAT passes.
