# Explicit read-only QuickGuard sandbox invoice previews

The controlled Basic subscription is present and active in the connected QuickGuard sandbox (`acct_1SYmuoIMkpwfAEDT`), with the customer and price IDs already stored in QuickGuard. The existing reconciliation endpoint uses only `STRIPE_SECRET_KEY`; its configured credential could not retrieve that sandbox object. No stored customer/subscription/price ID should be replaced to work around an environment mismatch.

The preview now offers Invoice account → QuickGuard sandbox (read-only). This sends `stripe_environment: 'sandbox'`, a single local subscription UUID and `dry_run: true`. The server authenticates the same active finance/admin role with MFA, refuses unscoped or mutating sandbox requests, and reads `STRIPE_SANDBOX_READ_KEY` only for this explicit preview. Missing or non-test keys fail closed without falling back to the billing key. The returned subscription must have `livemode=false`; customer, subscription, price, currency and existing-ledger checks remain mandatory. Sandbox responses carry explicit environment and mode evidence, which the UI validates before accepting a result. Account changes clear previous evidence; pending previews lock the selection. No test account flag or email determines the Stripe environment.

The existing configured-account preview and batch reconciliation continue using `STRIPE_SECRET_KEY`. No sandbox write/reconciliation path has been added. Existing billing IDs, entitlement, webhook configuration and payment history are preserved. JWT verification remains enabled. SDK/API versions are deliberately retained for this surgical repair.

## Server setup

In the existing **QuickGuard sandbox** Stripe account, create or use a dedicated restricted test key with read-only access to subscriptions and invoices. Add it securely as **STRIPE_SANDBOX_READ_KEY** in the production QuickGuard project's Edge Function secrets. Do not replace STRIPE_SECRET_KEY, grant write permissions, commit keys, or paste them into chat. A key for the live account or a different sandbox cannot resolve this fixture. The source code contains only the secret name; no credentials are included.

Supabase project: `vnywjfpkepjgclkbcmsj`. This setup is independent of HAL. The connectors available for this repair cannot create or edit Edge Function secrets; secret provisioning remains an operator action. Code preparation and tests do not establish that the server secret exists.

## Acceptance

After backend deployment, PR merge and Readdy publication, open Admin → Payments → controlled Basic renewal payment → Invoice account → QuickGuard sandbox (read-only) → Preview latest invoice. Compare the subscription and ledger hashes before and after. Expect the latest paid £10 sandbox invoice to be confirmed as already recorded if it still matches provider evidence. Missing/invalid credentials must show specific setup errors; account/object mismatches must remain review errors. Never use Reconcile all invoices for this preview acceptance. A successful preview is still pending server setup and a live retest.

References: https://docs.stripe.com/keys.md and https://supabase.com/docs/guides/functions/secrets .

## Validation evidence

The 24 focused invoice-preview/backfill tests passed. Repository/admin TypeScript and full lint passed; lint retains ten existing warnings and no errors. Production build passed with 214 pages using an unreachable placeholder Supabase URL. Strict backend source checking passed with the actual npm types for Stripe 14.10.0, Supabase JS 2.39.3 and compatible PostgREST 1.9.0, with minimal Deno environment/server signatures. A direct Deno check could not download the existing deno.land import because the network connection was refused; it is not claimed as passed. No runtime import or dependency version was changed for that limitation.

The full regression suite passed **1,131 tests**, zero failed. Focused tests verify sandbox read-only scope, missing/live/malformed keys, account separation, live/mixed-mode results, existing identity checks, failed provider/database reads, MFA/roles, old-server responses, missing sandbox mode evidence, setup errors, account-change clearing and pending locks.
