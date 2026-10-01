# Booking service fee policy

Client memberships remain £0 / £49 / £99 / £199 monthly. Paid annual memberships remain £490 / £990 / £1990. Guard memberships remain £10 / £19 / £29 monthly and £100 / £190 / £290 annually.

| Client plan | Booking fee on agreed guard pay |
| --- | --- |
| Free | 15% |
| Starter | 10% |
| Pro | 7.5% |
| Enterprise | 5% |

Processing and standard payout costs are included in this fee. Guards keep full agreed pay; no separate processing surcharge or guard commission is charged on new bookings. Eligible existing launch, introductory and lifetime promotions retain their calculation. Active/trialing client subscriptions determine the client plan, rather than stale profile flags or guard subscriptions.

An unknown plan, failed lookup or missing fee rule blocks checkout instead of silently applying 0%. Subscription checkout uses only the configured price and validates its active status, product, GBP currency, amount and monthly/annual interval. No price fallback is permitted.

Existing funded/refunded/processing booking previews use the recorded payment breakdown. Open Stripe checkout sessions are reused. Existing assignments, transactions and paid amounts are not migrated. An expired checkout gets a new policy-v2 attempt; its idempotency key includes the previous session so an expired session is not returned indefinitely.

VAT registration and Stripe Tax are unchanged. Unsupported frontend VAT estimates and placeholder invoice address/VAT number have been removed. This change does not establish a tax policy.

## Rollout

On 1 October 2026 the `client_booking_fee_policy_v2` migration was applied to QuickGaurd (`vnywjfpkepjgclkbcmsj`). Both `app` and `public` fee rules were verified. Deployed functions: create-job-payment v54, calculate-job-fees v13 and create-subscription-checkout v77. JWT settings were preserved, including existing custom authentication in subscription checkout.

Frontend changes require the PR to be merged and the updated source deployed/pulled into Readdy. Stripe catalog changes were unnecessary. Only the connected QuickGuard Stripe sandbox was available; no live Stripe catalog was changed and no real payment was made.

## Validation

`node --test tests/booking-policy.test.cjs`: 10 passing tests, covering plan fees, rounding, guard pay, missing configuration, promotions, price validation and funded historical snapshots. Function syntax checked. Deployed subscription checkout returned HTTP 400 for an invalid billing period. Next production build completed. Full TypeScript check has legacy failures outside changed frontend files. Build reports missing ESLint (existing dependency configuration).

A signed-in sandbox booking/payment/webhook/payout test remains necessary before claiming complete payment lifecycle verification.
