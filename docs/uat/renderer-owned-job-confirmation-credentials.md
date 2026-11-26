# Renderer-owned job confirmation credentials

## Problem and change

`send-job-posted-email` delegates email delivery to `render-email-template`, but also required its own unused `RESEND_API_KEY`. The sandbox renderer instead uses its isolated sandbox key or its service-only Vault credential. That valid configuration could therefore fail in the sender before reaching the renderer.

Remove only the unused sender environment read and credential gate. The renderer remains responsible for provider configuration, recipient restrictions and delivery. Service-role authorization, private delivery controls, authoritative saved-job state, scheduled/live template routing and mandatory provider acceptance remain enforced. Renderer errors, malformed replies and missing provider IDs still fail without claiming delivery; `create-job` retains its email-failure warning.

## Validation on 26 November 2026

- Added an execution regression covering live and scheduled confirmations with no sender provider key, plus renderer failure in each case. Before the fix it reproduced HTTP 500 instead of 200; after the fix all 11 sender and scheduled-template migration tests passed.
- Repository TypeScript, strict Edge typing and lint passed. Lint retains the same 12 existing warnings and no errors.
- Deployed only the sender to sandbox `alfwwggavmyerjyqumuo`, version 59, ACTIVE, with gateway JWT verification preserved. Retrieved deployed source exactly matches the reviewed file.
- No production deployment, new migration, entitlement change or job-limit adjustment was performed for this fix.

## Native acceptance passed

The earlier native test client had consumed its one free job. A second insert would exceed that allowance, including a scheduled draft. After explicit approval of a fresh test inbox alias, one disposable client registered through `register-magic-link`. Its activation email was delivered, native verification succeeded and `complete-client-profile` completed its profile. The earlier client's entitlement and usage were preserved.

The actual `create-job` handler saved one future draft and returned HTTP 200 with no warnings. The stored job was `draft`, `is_draft=true`, scheduled for 1 December 2026 at 10:00 GMT, with notification status `none` and zero notified guards. Its downstream sender and renderer created exactly one `job_scheduled` delivery audit. Resend confirmed delivery at 13:47:30 GMT on 26 November to the already approved main test inbox, from the selected QuickGuard notification sender. The received message contained the correct UK publication time, stated that the job was not yet visible and guards had not been notified, and contained no unresolved variables or false live-job claim.

Replaying the same authenticated submission returned the same job with `idempotent=true`. There remained exactly one job and one confirmation audit. The email queue's complete row hash matched its pre-test baseline, proving no guard email was queued.

Cleanup removed only the disposable scheduled draft, retained its delivery audit, signed the client out globally and deactivated its clearly marked synthetic profile. Zero test jobs and zero test sessions remain. All retained job rows and all email queue rows exactly match their pre-test hashes. The original single-recipient allowlist and `dry_run` mode were restored, the prior synthetic guard remains inactive and no scheduler cron is active.

This establishes the sandbox native creation-to-provider-delivery chain. It does not establish browser inbox-click activation, eventual scheduled publication, production full-flow acceptance or financial/bank settlement.

## Rollout

Merge only after the current PR checks and review pass. This sender-only fix requires no template migration or frontend publication. Preserve the target project's JWT setting and private delivery controls when deploying. Production currently retains the prior approved sender version; this sandbox deployment does not change production behavior.
