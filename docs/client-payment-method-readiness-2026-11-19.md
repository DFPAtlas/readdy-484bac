# Client payment-method status — 19 November 2026

Account Health previously marked Payment method added complete from any transaction or customer ID. Billing and its payment summary also called a customer ID Card on file. Creating a customer or making a historical one-off payment does not establish that a reusable method is attached.

## Result

Billing and Account Health share one authenticated, read-only `get-client-payment-method-status` result. They distinguish checking, unavailable/Retry, no saved method, a verified saved method and a billing link needing review. A saved method is not a promise that a future charge will succeed. No card details or provider identifiers are returned to the browser.

The health step counts as complete only after an attached method (or verified legacy default source) is confirmed and billing links are consistent. A customer ID and transaction history never supply this result. Unknown/error states are not presented as no method or complete. Returning focus from the billing portal refreshes the shared result; manual refresh and Retry are available. Superseded/unmounted responses cannot overwrite the current check, and a different client ID cannot display the previous client's result.

The new endpoint verifies the bearer token, account closure and active owned client. Caller-supplied client/customer identifiers are ignored. It reads only owned client/subscription bindings and then uses the configured Stripe account/mode. Contradictory customer ownership metadata, deleted/missing customers, ambiguous/mismatched subscription records, provider customer/mode mismatch or a missing provider subscription prevent a positive readiness result. Unavailable database/provider reads produce a generic retryable failure. Responses use Cache-Control: no-store.

An existence query needs at most one attached PaymentMethod, rather than a count of all methods. Existing legacy default card/bank sources are checked separately. Saved method type, expiry or future charge success is not asserted. Billing method management is disabled while checking, unavailable or requiring a billing-link review. The support link uses the existing Support Centre; it creates no ticket automatically.

## Existing test-account reconciliation

Read-only database and Stripe checks established that Atlas Event Services Test Ltd has a live profile customer with no attached PaymentMethods, no invoice default PaymentMethod and no default legacy source. Its stored Client Starter subscription refers to a different customer and an active £49 subscription in the QuickGuard sandbox; that subscription is not present in the live account. This explains the observed live portal having no saved method or corresponding live subscription history. It does not prove an incorrect live charge.

The repair flags this mismatch. It does not move sandbox subscriptions into live mode, copy payment methods, merge customers, alter entitlements or rewrite historical billing references. The account's test-to-live billing cutover remains a separate controlled task. Existing sandbox data must not be treated as live subscription acceptance.

## Release and acceptance

Deploy the new function before publishing its frontend. Keep `verify_jwt=true`; the handler additionally verifies the user and ownership. There is no migration, secret change, new package or payment/webhook/portal mutation in this change. Existing `STRIPE_SECRET_KEY`, Supabase server settings and database schema are used.

After merge, import latest main into Readdy and publish. On the test account, Billing and Account Health should show No saved payment method, Billing link needs checking, and no complete health step. The payment-method management button should be disabled pending reconciliation; Support Centre and Refresh remain available. No live card should be entered merely to retest these labels.

The focused tests execute the actual function, loader, hook and Billing/Preferences components. They cover auth/closure/owner scope, missing methods despite a customer, no-customer reads, modern/legacy saved methods, mismatched/missing/mode/ownership resources, sanitized failures, response validation, shared display/completion, error/Retry, focus refresh, superseded requests and unmount protection.

Validation: all 637 repository unit tests pass, including nine focused checks. Repository TypeScript and admin/financial checks pass. Final production build passes; changed-code lint is clean, and the full build lint has only the eight existing blog-image warnings. An earlier full lint also identified a new effect-cleanup warning; that warning was fixed before the final changed-code lint and build. No dependency changed.

Published signed-in acceptance remains pending. Saved-method add/remove/portal-return lifecycle, real provider failures and test-to-live subscription cutover require controlled UAT. No payment, refund, payout, subscription, customer, profile, notification or ticket was created or changed during investigation or implementation.

References: [Stripe PaymentMethods list](https://docs.stripe.com/api/payment_methods/list), [Stripe Customer object](https://docs.stripe.com/api/customers/object), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth-legacy-jwt), [Supabase authorization headers](https://supabase.com/docs/guides/functions/auth-headers).
