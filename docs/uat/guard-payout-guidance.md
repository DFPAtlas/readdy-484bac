# Guard payout explanation

The public guard guide previously placed client payment after shift completion
and jumped from the shift to a bank transfer. It omitted payout-account setup,
the guard completion request and the difference between a job transfer and a
bank deposit. Payout receipts also gave an unsupported 1–3 business-day estimate.

The guard guide and How It Works now share an ordered payout journey: Stripe
setup, client funding before confirmation, shift completion request, completion
review, eligible transfer to Stripe and a separately processed bank deposit.
The guide names the existing desktop **Mark Complete** and mobile **Request
Completion** controls. Help, FAQs, the client guide and payment terms use the
same distinction. Delayed approval or payment directs guards to their status,
Bank Settings, Earnings and support without promising an unverified timeout.
Expanded How It Works FAQ answers have no fixed height cap, so the longer
payout answer remains readable at narrow widths.

Both receipt formats explain that submission does not establish bank arrival
and link directly to `/guard/earnings`. The committed email preview illustrates
a new £100 booking with zero guard commission and a £100 transfer. Existing
receipt amounts, including any recorded historical guard fee, remain dynamic.

## Compatibility and deployment

There are no changes to payment amounts, billing IDs, eligibility, completion
approval, automatic approval, Stripe transfer execution or idempotency. There
is no database migration. An AST comparison against the base commit confirmed
that all payout-handler statements outside the two receipt-rendering functions
are identical.

The website wording requires the normal frontend publication after merge. The
receipt wording requires deploying `create-guard-payout` after review; publishing
the frontend alone does not update that function. No live booking, payout,
refund, account change or email send was used for validation.

## Validation

- Repository TypeScript: passed.
- Admin and financial TypeScript gate: passed.
- Repository lint: zero errors, ten existing warnings.
- Existing focused receipt, pricing presentation, completion, payout settings,
  payment display and bank-tracking checks: 40 passed.
- Full regression suite: 1,258 passed, zero failures (102 seconds).
- Production build: see the PR's Build Check result.

## Published acceptance

After frontend publication, read `/guide/guard#step-04`, `/how-it-works`,
`/how-it-works/clients`, `/help` in guard mode, `/guide/client` and `/terms`.
Check the longer payout FAQ at a narrow viewport and follow the Bank Settings,
Earnings and support links. Confirm the live wording before signing it off.
Receipt acceptance should use a synthetic preview or isolated sandbox job
after the Edge Function is deployed. A real-money payout test remains separate.
