# Client provider documents (C08)

The Payment Centre previously displayed stored receipt/invoice URLs only. Missing
URLs stayed "Receipt pending" indefinitely, even where Stripe already had a
receipt. It also implied every payment would eventually have an invoice.

The Receipts & Invoices tab now distinguishes saved links from a fresh provider
check, labels sandbox payments **Test payment — not a live charge**, and provides
an explicit per-payment Check latest documents / Retry action. A checked payment
without an issued Stripe invoice says so. Provider receipts, provider invoices and
the existing generated QuickGuard payment record remain distinct. The receipt
page can provide its own PDF download; this change does not generate tax invoices.
The existing job URL filter now also applies to the documents rows.

## Read-only provider lookup

`get-client-payment-documents` accepts only a transaction ID, validates the user,
account closure and active client, then reads that client's transaction. Caller
client/customer/Stripe IDs cannot select another owner. Existing ledger history
can be read even when a job has been deleted; no job mutation or status transition
is involved.

Stripe reads verify the stored Checkout/PaymentIntent relationship, exact client
and job metadata, original GBP amount, paid/captured state, customer, currency and
mode. The charge and any invoice must match the payment. A legacy intent-only
reference requires explicit owner/job metadata. Only allowlisted HTTPS Stripe
receipt/invoice links are returned; no customer, card, contact, secret or raw
provider object is returned. Responses are no-store. Missing bindings, provider
404s and mode mismatches have explicit states; infrastructure failures use a
generic Retry error. There is no fallback to another Stripe account or mode.

No invoice is created/finalized/sent and no payment, refund, subscription, billing
binding or notification is changed by the endpoint. It does not cache new links
in the ledger. Future matching-mode live payments can retrieve their current
provider links on demand without depending on a webhook having stored the URL.
Client responses are rejected if the authenticated user changes during the read;
sign-out/account changes and unmount invalidate pending document requests and
clear the payment rows. Older requests cannot replace a newer result.

## Historical repair already applied

All seven collected payments on the existing labelled test-client account were
looked up in **QuickGuard sandbox**, not live mode. The provider sessions, client
and job metadata, PaymentIntents, successful captured charges, original amounts,
recorded refund amounts and HTTPS receipt links were verified individually.
All seven have receipts; all seven Checkout invoice references are null.

Only their previously null `receipt_url` and `stripe_charge_id` were linked. The
single guarded transaction checked the exact stored transaction/session/intent/
job/amount/status/refund and null document fields before each change. It asserted
that every other field on all nine owned transaction rows remained identical,
including financial amounts/statuses, metadata and original timestamps. It
aborted unless exactly seven records changed. Post-check: seven linked test
receipts, zero invoice links, original gross £551 and refunds £204 unchanged.
No financial operation or Stripe write was performed. Private receipt bearer
URLs are deliberately absent from this document and repository.

The production Stripe key is live. A fresh lookup of these historical sandbox
payments therefore returns a mode mismatch without reading the wrong account.
Their verified saved test-receipt links remain available and explicitly labelled
as saved; the UI explains that they cannot be refreshed with the current payment
mode and may expire. No sandbox secret is added to production and no customer or
subscription is relinked. This is separate from C15 billing cutover.

## Validation and release

Focused tests exercise the actual endpoint, client loader and React document row:
ownership/closure/anonymous rejection, invoice binding, exact amounts, full and
partial refunds, test/live separation, missing references, provider errors/Retry,
unsafe URLs, auth changes, stale responses and unmount. The existing monthly
spending regression uses the new document module and auth subscription contract.

All **668 repository unit tests** pass, including 12 new focused provider-document
checks. Repository TypeScript and admin/financial checks pass. Changed code lints
clean; the repository retains its eight existing blog-image warnings. The
deployed endpoint is ACTIVE v1 with verify_jwt=true. Direct anonymous and
malformed-JWT POST probes return 401. An authenticated-client-role query sees
exactly nine owned transactions and seven linked receipts. These checks do not
claim a published frontend or authenticated live-Stripe document lookup pass.

Final project validation and deployed function version are recorded in the
consolidated client acceptance report. No schema migration, RLS/grant change,
webhook modification, dependency or secret update is required.

After review and passing GitHub checks, merge the PR, import latest main into
Readdy and publish. Then verify all seven rows show saved test receipts, open the
provider receipts and compare the original amount and refunds, exercise the
mode-mismatch explanation and retained saved link, and verify the job filter.
Actual provider receipt opening/PDF download and published frontend interaction
remain live acceptance until that retest. Positive live receipt/invoice lookup
and fault-injected live Retry remain controlled UAT; synthetic tests alone do not
certify those paths. Public launch remains on hold for the outstanding inventory.

References: [Stripe receipts](https://docs.stripe.com/receipts),
[PaymentIntent retrieval](https://docs.stripe.com/api/payment_intents/retrieve),
[Charge object](https://docs.stripe.com/api/charges/object), and
[Supabase authenticated functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt).
