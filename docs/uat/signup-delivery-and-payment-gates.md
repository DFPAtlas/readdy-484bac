# Signup delivery repair and remaining payment isolation gates

Date: 25 November 2026. Branch follows the job-confirmation repair in PR #281. All application deployments and synthetic account operations in this stage used isolated `qg-e2e-sandbox` (`alfwwggavmyerjyqumuo`). Production source, data, billing and webhook configuration were not changed.

## Confirmed repair

Registration previously discarded verification-email failures and returned `success: true, verification_sent: true` for both a newly provisioned account and a retry for an existing unverified account. An HTTP-200 template response without provider acceptance was also treated as successful sending. Users could reach the “check your email” page even though no verification message had been accepted.

Both registration paths now require a successful renderer response with `success: true` and a non-empty provider email ID. Failures return HTTP 503, `verification_sent: false`, a retryable explanation and `Retry-After: 60`. The existing unverified identity and free plan are preserved; retry requests a new link for that same identity. No password, session or email bearer token is returned. Provider acceptance is not a promise of inbox delivery.

Client and guard forms navigate only after explicit confirmation of verification-email acceptance. Failure keeps the entered fields and form available for retry. The verification page no longer claims mail was sent merely because it has an email query parameter.

The public resend endpoint keeps the same HTTP-200 `success: true, request_received: true` acknowledgement for eligible, unknown, already-verified, missing-profile and failed-delivery cases. It checks provider acceptance internally and records failures, while preserving account-existence privacy. The UI acknowledges a request rather than claiming delivery. This does not add a durable retry queue; a failed delivery needs another request after configuration/recovery.

## Evidence

- Six execution regressions load actual handlers and actual client/guard React form handlers: new/retry success; HTTP/JSON/network/link/provider failures; no returned credentials; rate limits and invalid requests; uniform resend responses; retained fields and navigation gates.
- All **1,357** repository tests passed; repository/frontend checks, existing strict guest/job-confirmation Edge gates, lint and a placeholder-backed production build passed. Lint retains 12 existing warnings and no errors. Signup Edge sources were transpiled and tested by execution; this is not a claim of full strict type coverage for their pre-existing untyped code.
- New browser smoke `scripts/uat/signup-delivery-browser-smoke.cjs` exercises client and guard registration at 1440px and 390px against synthetic APIs. It covers HTTP-503 failure, an HTTP-200 response lacking email confirmation, a successful retry, preserved inputs and private resend acknowledgement. It blocks all external traffic and unexpected function mutations; screenshots are included in the CI browser artifact. Exact-head CI results are recorded in the PR.
- Native sandbox API run **`qg-signup-996fa362ec5b3b69`** passed. The real renderer first returned HTTP 500 `Email service is not configured`. Real client and guard registration each returned honest HTTP 503 for the initial request and retry. A known and an unknown address received identical resend acknowledgements. These were freshly generated, non-deliverable `.invalid` fixtures, not reopened retained accounts.
- Database evidence after the native run showed exactly two Auth identities, one per email, both unconfirmed, with zero sessions. The client profile existed; the guard stayed inactive. Their free subscriptions were `client_free` and `guard_starter`, neither bound to Stripe. No live job, funded payment or payout was created.
- The fixtures were tagged using exact UUID/email/creation-time/role checks, then their unbound free subscriptions, profiles, identities and run-specific rate-limit rows were removed. No fixture Auth/session/profile remains. Security audit history is preserved.

| Dataset | Identical pre/post digest or count |
| --- | --- |
| Jobs | `8a8b25506eb8ec7084898c1f28fef7f2` |
| Subscriptions | `ded27d148e4e730c0fd9f53938eb2c5c` |
| Entitlements | `f84559605e00f25f891995d55c122104` |
| Email queue | `48f6c4c22294a2d9413673f52ada7bb9` |
| Sandbox email send log / active cron | 0 / 0 |
| Remaining native-run Auth identities / client+guard profiles | 0 / 0 |

Native rerun harness: `scripts/uat/signup-delivery-failure-smoke.cjs`. Supply a fresh mode-0600 `QG_SIGNUP_UAT_STATE` JSON file with `project: alfwwggavmyerjyqumuo` and the legacy anonymous `publicKey`; never a service key. It generates its own `.invalid` addresses, refuses reused state and requires the email-unconfigured sandbox before attempting signup. The operator must verify one unconfirmed identity per address, zero sessions and appropriate profile state, then clean up only those exact newly created records. It deliberately does not assert success for native delivery.

Sandbox deployments: `register-magic-link` v69 and `resend-verification-link` v21, gateway JWT verification retained true. Original deployed sources were captured and compared before replacement: registration had one extra unused `source` destructuring binding; resend differed only in trailing whitespace. No production deployment was made.

## Authorized email delivery check

The owner nominated a test inbox and explicitly selected `QuickGuard <notifications@quickguard.uk>` as sender. Resend currently reports `quickguard.uk` verified, with sending enabled and open/click tracking disabled.

One clearly labelled **“QuickGuard delivery test — launch checks”** message was sent through the connected Resend service. It contained no sign-in or activation link. Resend email ID **`01a214bd-ef49-784b-9909-a94f3669395e`**, created at **22:05:21 GMT**, subsequently reported **delivered**. The send used a stable idempotency key to prevent duplicate messages on retry. The inbox address is intentionally omitted from this repository document.

This verifies provider delivery to Gmail’s server, not inbox/spam placement, native sandbox registration delivery, a clicked verification link or a complete browser onboarding journey. The owner can report inbox placement in chat. No contact/audience or marketing campaign was created.

## Remaining gates: concrete preflight findings

1. **Native sandbox email is unconfigured.** Its renderer returns `Email service is not configured`; `app.email_templates` has zero rows. The connected Resend account’s delivery success does not configure the sandbox runtime. Prepare the reviewed signup/job templates, a restricted sending key and a sandbox recipient allowlist before enabling native test delivery. Keep job confirmation `job_posted_email_delivery_mode = dry_run` until an explicit native delivery test is ready.
2. **Sandbox verification links currently target production.** Registration/resend construct `https://quickguard.uk/auth/email-dashboard#...` even when running in the test project. A sandbox-issued token must be consumed by a preview configured against that same sandbox. Prepare and validate an allowlisted sandbox preview/callback destination before native inbox-click acceptance; never send a sandbox token expecting production Auth to consume it.
3. **Stripe test callbacks are not isolated to one project.** The connected QuickGuard sandbox account is test mode (`livemode: false`) but its three enabled webhook endpoints target: sandbox `alfwwggavmyerjyqumuo/enhanced-stripe-webhook`, production `vnywjfpkepjgclkbcmsj/stripe-bank-payout-webhook`, and another project `dnbvybmulsppfjntbsxz/enhanced-stripe-webhook`. The production payout receiver source has a signed-event livemode guard; the callback topology still is not an isolated test environment. No test payment, transfer, payout, refund or provider-object mutation was attempted. Existing endpoints were not disabled or changed. Use an isolated Stripe sandbox/callback set, and verify receiver mode guards, before the full payment test.
4. **Admin payment-test mutations need MFA alignment.** Deployed sandbox `admin-test-job-payment` v36 authenticates an active finance/super administrator but has no AAL2 check. Inspect and repair that sensitive endpoint before using administrative payment-test actions. Its simulated funded/completion actions are not substitutes for a real signed-provider checkout/webhook/payout test.
   The subsequent [MFA repair evidence](admin-payment-test-mfa.md) records the sandbox v38 fix and real-account validation; release review and production rollout are still separate steps.
5. Retain the earlier scheduled-job email wording, final legal/engagement review, production guest-retention activation and complete final smoke gates. This stage does not sign off launch readiness or live financial operations.

Merge order: guest feature PR #280, job-confirmation PR #281, then this signup repair retargeted to main. Review each current head and rerun required checks after any retarget or conflict resolution. Roll back the signup stage by restoring the captured sandbox handlers or reverting this branch; no schema migration was introduced.
