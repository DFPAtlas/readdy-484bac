# Renderer-owned job confirmation credentials

## Problem and change

`send-job-posted-email` delegates email delivery to `render-email-template`, but also required its own unused `RESEND_API_KEY`. The sandbox renderer instead uses its isolated sandbox key or its service-only Vault credential. That valid configuration could therefore fail in the sender before reaching the renderer.

Remove only the unused sender environment read and credential gate. The renderer remains responsible for provider configuration, recipient restrictions and delivery. Service-role authorization, private delivery controls, authoritative saved-job state, scheduled/live template routing and mandatory provider acceptance remain enforced. Renderer errors, malformed replies and missing provider IDs still fail without claiming delivery; `create-job` retains its email-failure warning.

## Validation on 26 November 2026

- Added an execution regression covering live and scheduled confirmations with no sender provider key, plus renderer failure in each case. Before the fix it reproduced HTTP 500 instead of 200; after the fix all 11 sender and scheduled-template migration tests passed.
- Repository TypeScript, strict Edge typing and lint passed. Lint retains the same 12 existing warnings and no errors.
- Deployed only the sender to sandbox `alfwwggavmyerjyqumuo`, version 59, ACTIVE, with gateway JWT verification preserved. Retrieved deployed source exactly matches the reviewed file.
- No production deployment, new migration, entitlement change or job-limit adjustment was performed for this fix.

## Native acceptance still pending

The earlier native test client has already consumed its one free job. A second insert would exceed that allowance, including a scheduled draft. A fresh disposable native client is needed to exercise `create-job` without changing its entitlement or usage.

No fresh client, scheduled job or outgoing confirmation was created in this attempt. The original sandbox recipient allowlist was restored; delivery remains `dry_run`, the prior synthetic guard remains inactive and no scheduler cron is active. The previously delivered direct template test establishes template/provider delivery only, not the complete native creation chain.

With an explicitly approved fresh test inbox, register and activate one synthetic client through the native handlers, complete its profile, then submit one future scheduled draft with the already approved confirmation recipient. Verify the stored draft, no guard notification, one accepted/delivered scheduled email with the correct UK publication time, and a replay returning the same job without a second email. Remove the disposable draft before its publication time, sign out the test session and restore the original delivery controls. Do not mark native acceptance complete until these checks have run.

## Rollout

Merge only after the current PR checks and review pass. This sender-only fix requires no template migration or frontend publication. Preserve the target project's JWT setting and private delivery controls when deploying. Production currently retains the prior approved sender version; this sandbox deployment does not change production behavior.
