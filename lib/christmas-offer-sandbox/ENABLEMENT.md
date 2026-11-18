# Christmas offer — sandbox-only draft (unpublished)

Status: source draft only. Nothing is deployed, enabled, published or connected. The live
QuickGuard project, database, Stripe objects, secrets and the existing checkout functions
are unchanged.

## What the offer does in this draft

| Item | Value |
| --- | --- |
| Offer id | `christmas-2026-free-until-jan` (version 1) |
| Eligible plans | monthly `guard-pro` (£19.00) and monthly `client-pro` (£99.00) |
| Who qualifies | new accounts with no existing paid, trialling or founding subscription |
| Due today | £0, payment method required (`payment_method_collection: 'always'`) |
| First regular charge | 1 January 2027, 00:00 UK time (`1798761600`) |
| Intended offer window | 24 Nov 2026 00:00 UK → 30 Dec 2026 00:00 UK, exclusive (29 Dec is the last sign-up day) |
| Supported test sign-ups | 24 Nov 2026 00:00 UK → 29 Dec 2026 23:59:59.999 UK |
| Promotion state | off by default; requires explicit env opt-in plus a live identity check |

## Cutoff and the independent Stripe minimum

The business cutoff and Stripe's own trial rule are two separate checks. Both are enforced,
and neither is derived from the other.

**Business cutoff (single exclusive boundary).** `offerEndIso` is `2026-12-30T00:00:00.000Z`
and the comparison is `now >= offerEndIso`, so:

* `2026-12-29T23:59:59.999Z` → eligible.
* `2026-12-30T00:00:00.000Z` and anything later → `offer_ended`.

**Stripe minimum (unchanged, retained unconditionally).** Stripe needs at least 48 hours
between checkout and the agreed first charge of `2027-01-01T00:00:00Z` (`1798761600`). The
earliest moment that still satisfies "at least 48 hours" is exactly
`2026-12-30T00:00:00.000Z`; `trialEndOutsideStripeMinimum` returns `false` there (exactly 48
hours satisfies the rule) and `true` from `2026-12-30T00:00:01.000Z` onwards. The same guard
runs again immediately before the Stripe call, and Stripe's own rejection is translated into
the same explicit code.

Because the business cutoff fires first, midnight on 30 December returns `offer_ended` even
though Stripe would technically accept that instant. The Stripe check stays in place as
defence in depth, not as a second closing date.

**No early charge.** `trial_end` is always the fixed epoch `CHRISTMAS_OFFER.firstChargeAt`
(`1798761600`); it is never `now`, never a computed offset, and never shortened to keep a
late sign-up working. If the date cannot be honoured, the session is not created.

The offer is **not** open on 30 or 31 December 2026. There is no later cut-off date in this
draft, and no workaround is invented here. A 30–31 December extension would need a separate
business decision and would still be limited by the Stripe minimum.

## Reuse of existing, trusted machinery

* `_shared/subscription-price.ts` → `matchesSubscriptionPrice` confirms the Stripe price is
  active, GBP, monthly, and matches the catalogue plan product and amount.
* The plan row is read from the existing `plans` catalogue with `active = true`; the plan
  audience must match the account type. No product, price or coupon is created.
* `check-stripe-session` already treats `trialing` as a valid activation state and applies
  the plan, profile, subscription row and `user_entitlements_data` Pro features.
* `enhanced-stripe-webhook` already maps the subscription price back to a plan through
  `planForPrice`, including `trialing`, so the trusted webhook path needs no change.
* `_shared/payment-freeze.ts` still blocks all Stripe work while the emergency freeze is on.
* `_shared/subscription-profile.ts` keeps guard/client column differences correct.
* The new function separates the anon client (session verification only) from the
  service-role client (privileged reads), matching current platform expectations.

## Enablement gate (server-side only)

The function refuses to do anything unless all of the following are true:

1. `CHRISTMAS_OFFER_SANDBOX_ENABLED` is exactly `true`.
2. `CHRISTMAS_OFFER_SANDBOX_PROJECT_REF` is set.
3. The configured reference is **not** `vnywjfpkepjgclkbcmsj` (QuickGuard production).
4. The configured reference equals the reference derived from the running
   `SUPABASE_URL` (`https://<ref>.supabase.co`).
5. Stripe returns account `acct_1SYmuoIMkpwfAEDT`.
6. `stripe.balance.retrieve()` reports `livemode: false`.
7. The catalogue price and product retrieved from Stripe are `livemode: false`.
8. The created Checkout Session is `livemode: false`; otherwise it is expired immediately.

Client flags (`enabled`, `testMode`, `sandbox`, hostname) are never accepted as
authorisation. Any failure returns `promoAvailable: false` with a code plus a plain
"test only" explanation, and starts nothing.

## Remaining steps to actually run a test checkout

These were intentionally not performed (no deploy, no secret change, no Stripe change):

1. Create or choose an isolated test Supabase project (reference must differ from
   `vnywjfpkepjgclkbcmsj`).
2. Copy `lib/christmas-offer-sandbox/policy.mjs` to
   `supabase/functions/_shared/christmas-offer-policy.mjs`.
3. Copy `lib/christmas-offer-sandbox/checkout-function.ts.txt` to
   `supabase/functions/christmas-offer-checkout/index.ts`.
4. Deploy that function to the isolated test project only, with JWT verification on.
5. In that test project set `CHRISTMAS_OFFER_SANDBOX_ENABLED=true` and
   `CHRISTMAS_OFFER_SANDBOX_PROJECT_REF=<test project ref>`.
6. Confirm `STRIPE_SECRET_KEY` in that test project is a test-mode key for
   `acct_1SYmuoIMkpwfAEDT`. The function fails closed if it is not.
7. Ensure the test project's `plans` rows for `guard-pro` / `client-pro` point at
   test-mode prices of 1900 / 9900 pence with matching products, and that the test
   project's Stripe webhook points at its own `enhanced-stripe-webhook`.
8. Optional wiring for a wizard-driven test: call `christmas-offer-checkout` from the
   new-user wizard in place of `create-wizard-checkout` when the preview reports
   eligibility. This is an edge-function edit and could not be made here because the
   functions tree is deploy-only in this environment.
9. Open `/subscription/christmas-sandbox` while signed in as a brand-new test guard or
   client. It shows the test-only result and never appears in navigation or the sitemap.

## Local checks

`lib/christmas-offer-sandbox.test.cjs` covers the policy with an injected clock:
offer start edge, the exclusive 30 December 2026 cutoff down to the millisecond
(`23:59:59.999` eligible, `00:00:00.000` → `offer_ended`), the independent 48 hour Stripe
minimum boundary (exactly 48 hours satisfies it, one millisecond later does not), the
guaranteed no-early-charge epoch, ineligible plans, annual billing, account-type mismatch,
existing paid/trialling/founding accounts, every sandbox gate
failure, catalogue amounts, metadata shape, and source contracts asserting that the live
checkout functions are untouched.

The suite is registered in `npm run test:unit`. Execution requires a shell in the project
workspace, which this session does not have, so the suite has not been run here.

## Files touched

* `lib/christmas-offer-sandbox/policy.mjs` (new, pure policy + injectable clock)
* `lib/christmas-offer-sandbox/checkout-function.ts.txt` (new, deploy-ready source)
* `lib/christmas-offer-sandbox/ENABLEMENT.md` (new, this document)
* `lib/christmas-offer-sandbox.test.cjs` (new, local tests)
* `app/subscription/christmas-sandbox/page.tsx` (new, noindex harness)
* `app/subscription/christmas-sandbox/ChristmasSandboxClient.tsx` (new)
* `app/subscription/christmas-sandbox/SandboxNotice.tsx` (new)
* `app/subscription/christmas-sandbox/SandboxStatusPanel.tsx` (new)
* `app/subscription/christmas-sandbox/SandboxPlanButtons.tsx` (new)
* `app/subscription/christmas-sandbox/types.ts` (new)
* `package.json` (test script only)

Not touched: any `supabase/functions/*` file, any migration, Stripe objects, secrets,
`app/pricing`, the wizard, the success page, or live checkout behaviour.