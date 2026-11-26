# Native onboarding and checkout acceptance — 26 November 2026

Scope: isolated Supabase `alfwwggavmyerjyqumuo`, Stripe sandbox `acct_1SYmuoIMkpwfAEDT` (`livemode: false`) and the existing owner-private QuickGuard test site. No production deployment, production data change, live payment or PR merge.

## Repairs

- Sandbox onboarding had no wizard configuration or document buckets. Copied the 43 reviewed production wizard configuration rows into the sandbox; created only the sandbox buckets with the reviewed size/type/public settings and existing owner/admin-MFA storage policies.
- Connect account/link handlers fell back to production return URLs when `SITE_URL` was absent. All four checkout/Connect entrypoints now require the exact private sandbox origin and a test-mode key in this sandbox; their legacy production URL behaviour remains unchanged. Invalid sandbox configuration fails before provider calls or profile writes.
- Private document previews briefly showed failure before their signing effect started. Start in the loading state when a path exists; preserve real error and cancellation behaviour.
- Align driving-licence/address-document validation and help text with the actual 5 MiB private bucket limit. SIA bucket remains 10 MiB.
- Correct client onboarding copy to say bookings are funded before the shift and posting follows plan limits. Correct the guard completion button's literal HTML entity.

Sandbox-only Edge deployments: `create-guard-connect-account` v35, `create-guard-onboarding-link` v34, `create-job-payment` v84, `create-subscription-checkout` v107. No other function replaced by these changes.

## Native and browser evidence

Run `qg-native-20261126-33686605972dc2a1` uses two fresh synthetic accounts. The two disposable accounts from the previous activation test were removed by exact ID; their Auth/profile/subscription rows are absent, while delivery audit records remain.

| Check | Observed result |
| --- | --- |
| Client and guard native registration | HTTP 200, `verification_sent: true`; approved sender, both messages delivered |
| Delivered token verification | Native Auth HTTP 200; confirmed emails and protected client/guard roles |
| Client native completion | Success; forged protected field rejected |
| Guard native completion | Missing fields rejected; stale submission HTTP 409; current submission succeeds |
| Document storage | Five clearly synthetic PNG uploads; owner signing succeeds; other account signing denied |
| Actual client wizard in private browser harness | Required-name validation shown; all six steps completed and native saved profile confirmed |
| Actual guard wizard in private browser harness | All eight steps completed; both SIA images and three private document previews loaded; native saved profile confirmed |
| Guard approval boundary | Guard remained inactive after onboarding; application correctly HTTP 403 before fixture qualification |
| Job submission retry | Returned the same native job ID without a duplicate |
| Selection authority | Forged £1/one-hour browser amounts ignored; server stored eight hours at £15 |
| Checkout retry | Returned the same `cs_test_` session |
| Actual Stripe-hosted payment | Test card submitted in browser; Stripe showed success and returned to the private sandbox |
| Native webhook result | Booking `confirmed`/`funded`; transaction completed; Stripe session `complete`/`paid`, `livemode: false` |
| Payment totals | Client £138, guard £120, client platform fee £18, guard service fee £0; no VAT charged |
| Premature completion | Rejected before check-in |
| Payout authorisation | Client/guard tokens with forged internal approval fields both HTTP 403 |
| Repeated payment after funding | HTTP 400, booking not ready for payment; no new checkout |

The private harness runs the real onboarding components with native sandbox Auth/Data API/Storage and an owner-only, same-origin, expiring function transport. Native token consumption was tested over HTTP; this is **not** proof of an actual browser inbox-click flow. Guard completion did **not** prove real SIA verification or admin approval.

For the payment fixture only, the new synthetic guard was explicitly marked `is_test_account`, tagged with protected Auth run provenance and temporarily qualified by a scoped service-side seed. `verified_by` is a synthetic reviewer UUID, not a real administrator. This seed is not admin-approval acceptance evidence. Restore the guard to inactive when the run closes.

Booking: `deff5f97-815e-4853-a719-b5eb02b6b748`; assignment: `6a4d0383-75d2-48ee-b786-47392aa9891d`; transaction: `1ba1cacc-e1d9-400a-84c6-89a53bb43c35`; payment intent: `pi_3UfwmpIMkpwfAEDT0vACfR7m`.

Fresh native Express test account: `acct_1UfwohEYRsNWZ3cP`. It initially has inactive transfers and disabled payouts with onboarding requirements due. Its hosted setup explicitly displays test-account status and Stripe Connect terms. **Terms acceptance is awaiting action-time user confirmation. No transfer, bank payout or payout-complete claim is made.**

Job-posted email delivery remains in sandbox `dry_run`; payment freeze remains false; no cron enabled. The already closed legacy fixture controllers were not reopened.

## Validation and remaining gates

Repository typecheck and admin/financial type gate passed. Full unit suite before the seven document regressions: 1,374 passed; all 12 new origin/document regression tests passed separately. Repository lint has zero errors and 12 pre-existing warnings. Private-site typecheck, targeted lint, boundary tests and production artifact build passed.

Complete the approved sandbox Connect/completion/payout sequence, verify native webhook reconciliation and duplicate-transfer protection, close the temporary native sessions/bootstrap, remove test aliases from the sending allowlist and verify retained core fixtures remain unchanged. Inbox-click acceptance, scheduled-email wording, legal/engagement review, production retention activation and final launch smoke remain separate launch gates. This document is not launch sign-off.
