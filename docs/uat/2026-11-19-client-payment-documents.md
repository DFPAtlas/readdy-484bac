# Client smoke-test repair: payment documents (C01)

## Problem and resulting behavior

The legacy Payment History download action recalculated a historical charge from
the current job's hours, rates and guard count, added a fixed 20% VAT, and opened
the shared invoice preview without the transaction's payment status or date.
A recorded £11 completed payment consequently appeared as £13.20 awaiting
payment, with a newly invented deadline and placeholder bank details.

Payment History now reads the selected transaction again, scoped to the signed-in
client, and uses its saved amount, currency, status and timestamps. The job payment
page passes its already owner-scoped transaction to the same document builder.
Neither path recalculates historical fees or adds tax. The record uses the actual
transaction ID as its reference. Full and partial refunds show the original
transaction amount and recorded refund separately; missing facts are labelled
"Not recorded". Invalid amounts, ownership mismatches and failed reads show an
error rather than a fabricated document.

Because this data does not contain a complete recorded invoice/tax breakdown,
the document is labelled **Payment record**, not a VAT invoice. Before a transaction
exists, the job payment page can show a clearly labelled **Payment estimate** from
the checkout's existing fee breakdown. A settled job whose transaction cannot be
loaded does not fall back to an estimate. Formal invoice issuance and provider
receipt retrieval remain separate work.

The screen, downloaded HTML and print view use the same React-rendered document.
React escapes client/job text in all three. Placeholder bank instructions and
invented invoice/due dates have been removed from the shared preview.

## Automated regression coverage

`tests/client-payment-document.test.cjs` covers:

- £11 remains £11 even if current job pricing, dates or guard count change.
- Paid, pending, failed, cancelled, disputed, full/partial refund and unknown states.
- Recorded payment/refund dates, missing facts, legacy GBP and supplied currency.
- Invalid amounts/refunds and mismatched client/job IDs fail closed.
- Owner-scoped reads, missing/failed database results, sign-out and account changes.
- Superseded, unmounted and account-generation changes cannot open stale previews.
- The job payment page shares the transaction document; missing settled records
  do not produce estimates.
- Screen/export document consistency and escaping of hostile client/job text.

## Signed-in acceptance checks after publishing

1. Payment History → Job Payments → download the affected completed £11 payment.
   Expect Payment record, Paid, £11.00 and the recorded October payment date.
2. Open the same job's payment page and its document action. Compare transaction
   reference, status, amount and dates with Payment History.
3. Download the HTML and open it locally; print from the preview. Confirm matching
   facts, readable formatting and no bank instructions or demand for £13.20.
4. Check a fully refunded and partially refunded transaction. Confirm the original
   amount and actual refund appear separately, with no new payment demand.
5. Check an unpaid job with no transaction. Its document must say Payment estimate.
6. Check failed/unknown records and interrupted sign-in. Errors must be explicit;
   another client's transaction must remain inaccessible.

This PR does not run a payment, send email, change database permissions, or deploy
an Edge Function. Other client smoke-test findings (including Payment Centre
receipt availability, payment summaries, Job History, tracking and replacement
status) remain open and require their own repairs and retests. Public launch
remains on hold.
