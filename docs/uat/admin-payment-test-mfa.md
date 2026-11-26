# Admin payment-test MFA repair

Date: 25 November 2026. Scope: `admin-test-job-payment` authorization and isolated sandbox acceptance only. Follows signup repair PR #282. No production deployment, merge, Stripe object creation, test/live charge, transfer, refund, payout or webhook change was made.

## Problem and behavior

The endpoint checked a real signed-in user and current active finance/super-admin membership, but did not require MFA before its payment-test actions. Protecting the admin browser route alone does not protect a directly called function.

After server Auth verification, the endpoint now calls existing `app.is_active_admin()` through the **caller-bound anonymous client carrying that user's JWT** in the `app` schema. The database helper checks current active membership and AAL2. Only explicit boolean true proceeds; missing/null/invalid results deny access, and database/transport failures return a safe HTTP 503. Request-body role/MFA fields and editable Auth user metadata are never authorization evidence.

The existing service-side active finance/super-admin role lookup still follows that gate. Stripe SDK initialization, action parsing, data access and payment-test actions occur only after both checks. The emergency payment freeze remains ahead of all operations. Gateway JWT verification stays true, existing method/CORS behavior is preserved, and live-mode mutations remain blocked. The read-only `check_mode` action now also requires MFA.

The implementation awaits Supabase's then-only RPC builder in `try/catch`; it does not assume that builder has a Promise `.catch()` method. Execution regressions use a then-only builder to preserve this compatibility.

## Validation

Four actual-handler execution regressions cover all action-name denial probes, false/null/string MFA results, spoofed request and user-metadata role/MFA claims, RPC errors and thrown transport failures, current role/active membership, valid finance/super-admin reads, absent/invalid Auth, emergency freeze and live mutation blocking. Rejected authorization never constructs a Stripe client or reaches service-side data operations. The full **1,361-test** repository suite passed; lint has no errors and the same 12 pre-existing warnings. This branch changes no Next.js application code beyond the already validated parent; CI also rebuilds and repeats all browser smoke scripts.

Native run **`qg-admin-mfa-ce036b1ec5a14e68`** used one fresh synthetic finance administrator with protected Auth run provenance and a random private password. The real Supabase Auth password endpoint issued AAL1, and a genuine TOTP enrollment/challenge/verification issued AAL2. No JWT was forged or database MFA claim manufactured.

| Native probe | Result |
| --- | --- |
| Original sandbox v36 accepts AAL1 read-only mode check | Reproduced: HTTP 200, mode `test` |
| Repaired v38 rejects original AAL1 mode check | HTTP 403 |
| Repaired v38 rejects body `role=super_admin, aal=aal2` | HTTP 403 |
| Incomplete funding-action authorization probe without job/assignment IDs | HTTP 403 before action input processing |
| Genuine TOTP AAL2 finance session reads mode | HTTP 200, mode `test` |
| Original AAL1 token after MFA remains insufficient | HTTP 403 |
| Remove only the temporary finance membership during cleanup | Mapping removed |
| Fresh real password + TOTP AAL2 session after membership removal | HTTP 403, current MFA-admin membership required |
| Global fixture logout | HTTP 204; zero remaining sessions |

The revocation probe re-authenticated after removing the temporary membership, so its 403 was not merely an expired/logged-out token. The existing super-admin-only role-update trigger was preserved; no trigger was disabled and no caller identity was impersonated. The test removed only its own temporary membership as part of cleanup. The mode result verifies the sandbox runtime's configured key type; it does not prove that all Stripe callback destinations are isolated or complete checkout/webhook settlement.

The original deployed handler matched repository source apart from trailing whitespace. Final sandbox deployment: **`admin-test-job-payment` v38**, gateway JWT verification true. The original v36 handler and dependencies were captured before replacement; no schema migration was introduced.

## Cleanup receipt

The test's one Auth identity, one verified TOTP factor, sessions and administrator mapping were removed with exact UUID, email and protected run-provenance checks. Its private credentials were discarded after cleanup. No existing account was reopened or changed; security audit history is preserved.

| Dataset | Final count or unchanged pre/post digest |
| --- | --- |
| Temporary Auth / MFA factors / admin mapping / sessions | 0 / 0 / 0 / 0 |
| Jobs | `8a8b25506eb8ec7084898c1f28fef7f2` |
| Subscriptions | `ded27d148e4e730c0fd9f53938eb2c5c` |
| Entitlements | `f84559605e00f25f891995d55c122104` |
| Email queue | `48f6c4c22294a2d9413673f52ada7bb9` |
| Sandbox email send log / active cron | 0 / 0 |

The baseline digests use the same ordered JSON serialization as the preceding signup and guest acceptance receipts. The test endpoint made only read-only mode checks and denied incomplete authorization probes; no provider financial object or funded database record was requested or created.

## Safe native rerun

`QG_ADMIN_MFA_STATE` must reference a mode-0600 private JSON fixture file containing the hardcoded sandbox `project`, fresh `run` (`qg-admin-mfa-` plus 16 hex characters), new Auth `id`, corresponding `.invalid` `email`, random `password`, and legacy anonymous `publicKey`. Seed only a fresh protected-run-tagged finance administrator and inspect current triggers first. Do not use existing/retained closed accounts. The script stores Auth tokens and TOTP secrets privately; never commit or publish that state.

Run `scripts/uat/admin-payment-mfa-smoke.cjs` with phases:

- `baseline`: before the repair only, demonstrate the original AAL1 read-only mode result.
- `aal1`: after repair, verify denial with the original token and forged request fields.
- `aal2`: perform a real TOTP challenge and confirm read-only mode access, retaining AAL1 denial.
- Remove only that temporary membership with protected provenance checks, then `revoked`: sign in and challenge MFA again, confirming current membership is still required.
- `logout`: revoke fixture sessions; remove the exact temporary Auth identity/factors and verify zero residue and unchanged baselines.

No valid job or assignment ID is supplied to an authorization-denial probe. Do not use administrative simulated funding/completion actions as proof of actual provider payment success.

Remaining release gates are unchanged: isolated Stripe callbacks and full provider test-mode payment lifecycle, configured sandbox email and a sandbox-bound inbox verification/onboarding journey, scheduled-job confirmation wording, legal review, production guest-retention activation and the final complete smoke test. This repair closes the missing-MFA gate only. Merge prior stacked PRs in order, then retarget this repair to main and rerun required checks before release.
