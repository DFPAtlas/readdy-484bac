# Payment Centre payout timing

The published QA guard's Payment Centre displayed "Friday 27 November" as its
next estimated payout while Stripe verification was unavailable and pending
balance was zero. `useGuardPaymentCentre` unconditionally calculated the next
Friday from the browser clock; no Stripe schedule, pending deposit or arrival
date was used.

Remove that calculation and internal summary field. The card now links to the
existing Earnings bank-deposit ledger, where recorded arrival estimates appear
with individual deposits when available. A verified account status alone does
not establish an upcoming bank deposit, so the invented forecast is removed
for ready, checking and unavailable accounts alike.

The regression fails against the old actual page and checks all three Stripe
states, the ledger link, the absence of the supplied unsupported Friday date,
and unchanged recorded monetary totals. Existing provider readiness/action
gates, money calculations, payout/refund execution, CSV and billing are unchanged.

Frontend-only deployment: merge, pull into Readdy and publish. No migration,
Edge deployment, provider account change or financial transaction is required.
After publishing, check Payment Centre and follow View bank deposits to Earnings.
This PR does not resolve the QA guard's live/sandbox payout account mismatch or
constitute a live payment test. Keep live payment/refund last.
