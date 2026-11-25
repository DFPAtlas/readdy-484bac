# Sandbox activation and Stripe callback isolation

Date: 25 November 2026. Follows MFA repair PR #283. Only `alfwwggavmyerjyqumuo`, the existing owner-private Sandbox Tests site, the domain-restricted sending credential and Stripe test account `acct_1SYmuoIMkpwfAEDT` were configured. Production handlers, data, site and live Stripe account were not changed. No payment, transfer, refund or payout was created.

## Native activation delivery

Sandbox registration and resend now require `APP_URL` to match exactly `https://quickguard-e2e-sandbox.martin-s-hewett.chatgpt.site`, without a path, query, fragment or credentials. Production routing remains unchanged. One-time tokens stay in the URL fragment and are never returned by registration APIs.

The renderer uses a sandbox-only sending credential, encrypted in Supabase Vault. Its new `security_invoker` view exposes only the two named sandbox credentials to `service_role`; anonymous and authenticated browser roles cannot select it. The domain-restricted Resend key has sending access only. Other sandbox mailers remain unconfigured. Real renderer sends fail closed unless every recipient matches the private allowlist; previews do not require a mail credential. The final policy permits only the owner's nominated inbox. Job-confirmation delivery remains `dry_run`.

Reviewed production `signup_verification` and `job_posted` templates were copied into the previously empty sandbox, with `[SANDBOX]` subjects and a test-environment footer. Original HTML MD5 values were `7fa4eb437b1979824b90b6a5b1f239d1` and `c75ad556ad1f543e56e2bb6aed01fc1c`; sandbox copies are `78073783793ad13d99e318fb1394f377` and `2ca0b837e54a55cf5b8889a56a1d3f2f` respectively. No production template was edited.

Two fresh Gmail plus aliases delivering to the authorized inbox were temporarily allowlisted. Both identities were absent before testing. Native client and guard registration each returned HTTP 200 with `success: true, verification_sent: true`. Resend reported both emails **delivered**, from the explicitly selected `QuickGuard <notifications@quickguard.uk>` sender:

| Role | Provider email ID | Created (GMT) |
| --- | --- | --- |
| Client | `01a214ee-3d75-7f04-be16-c4e949f7c465` | 22:58:07 |
| Guard | `01a214ee-6d21-780b-98b8-b104b1b6ebb3` | 22:58:19 |

Both delivered messages contained the sandbox callback destination. Native Auth verification of each actual token returned HTTP 200, a confirmed email and the expected protected account type. Both issued sessions were immediately signed out globally; database inspection confirmed zero remaining sessions. Replaying the consumed client token returned HTTP 403 with no session. Guard approval remained false.

The existing owner-private test site now serves `/auth/email-dashboard`, configured exclusively against sandbox Auth with session persistence disabled. It clears fragments before interaction, waits for an explicit click, verifies the protected account type and closes the ephemeral session. Tests cover success, duplicate clicks, missing/failed/unconfirmed links and role mismatch. Browser review confirmed the published callback's missing-link state. Actual token verification above was performed through native Auth HTTP, not a full browser inbox-click/onboarding journey. Latest site source commit: `838eb32a6573fa1fdbb5ad5b3d48221417ef9aee`.

## Stripe callback isolation

The two enabled test callbacks now target only sandbox `alfwwggavmyerjyqumuo`:

| Endpoint | Purpose | State |
| --- | --- | --- |
| `we_1Udy3xIMkpwfAEDTwNYdfs5n` | Existing main billing webhook | Enabled, unchanged destination/signing secret |
| `we_1Ufp5RIMkpwfAEDTLBmnxRbf` | New connected-account payout receiver | Enabled, five payout lifecycle events, new signing secret encrypted in Vault |
| `we_1UMy8gIMkpwfAEDTZfF5eWTm` | Old test callback to production | Disabled; retained for reversible rollback |
| `we_1Tcnw2IMkpwfAEDTZeM6EHvQ` | Old test callback to another project | Disabled; retained for reversible rollback |

The new connected-account endpoint retains API version `2025-11-17.clover`, matching the main test endpoint. Both handlers now require event mode to match the configured `sk_`/`rk_` key; sandbox never accepts live mode. Main-handler rejection occurs before acquiring an event claim or touching business data. Sandbox payout signing-key lookup fails closed instead of falling back to other database keys. Production's legacy payout key rotation path is preserved.

Native payout policy probes returned HTTP 400 for missing/invalid signatures, HTTP 400 for a correctly signed live-mode event, and HTTP 200 `{ignored:true}` for a correctly signed test-mode unsupported event. These establish signing-key wiring and rejection behavior only; they are not Stripe-originated delivery, checkout or payout settlement evidence.

Sandbox deployed versions: renderer 46, registration 70, resend 22, main webhook 137, payout webhook 21. Gateway JWT settings were preserved; the renderer and webhooks perform their own authorization/signature checks.

## Validation and limits

Repository TypeScript and admin/financial type checks passed. Full unit run passed 1,367 tests; the subsequently added main-webhook pre-claim rejection and credential-migration permission tests also passed (eight focused isolation tests total). The migration test verifies that inherited browser grants are revoked and unrelated Vault entries stay hidden. Repository lint passed with pre-existing warnings. Sandbox callback tests, TypeScript, targeted lint and the Sites production build passed.

Automatic approval review stopped the local QuickGuard build when static blog generation attempted a production Supabase request. No retry of that request was made. The PR workflow uses a non-routable loopback URL and placeholder public key for its build, so CI can validate the code without production access; its final result must be reviewed separately.

The fixture cleanup call was interrupted before execution. A subsequent read confirmed both temporary identities/profiles remain, with zero sessions and the guard inactive. No existing account was reopened. Their one-time activation tokens have been consumed, and the temporary aliases were removed from the sending allowlist. Preserve email delivery audit logs. Complete exact-ID fixture removal before full smoke sign-off.

Remaining launch gates: complete browser inbox-click/onboarding acceptance, actual isolated provider payment lifecycle, scheduled-job email wording, legal/engagement review, production retention activation and the final smoke suite. This configuration step is not launch or live-payment sign-off.

Rollback: restore the captured previous sandbox handler versions and prior private site source, remove only the new sandbox credential/view configuration, disable the new test payout endpoint, and restore old endpoint states only after reviewing their external destinations. Never enable cross-project callbacks during an isolated payment test. Merge the preceding stacked PRs in order, then retarget and rerun required checks.
