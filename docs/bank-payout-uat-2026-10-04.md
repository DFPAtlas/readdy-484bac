# Bank payout verification — 4 October 2026

Result: Stripe sandbox bank payout completed with status paid. No real money moved.

- Connected recipient: acct_1UMvjsIl6yJPXXdQ (isolated API-created Custom sandbox account).
- Test bank: ba_1UMvjsIl6yJPXXdQ0IReLMXv, GB/GBP, last four 2345.
- Separate fixture funding transfer: tr_1UMxuvIMkpwfAEDTjOY6tKoH, £80.
- Bank payout: po_1UMxv4Il6yJPXXdQZoNiyUOV, £80, livemode false.
- Initial payout response: pending.
- Subsequent authoritative Stripe payout read: paid; failure_code null.
- Recipient available/pending balance after payout: £0.
- Test data follows Stripe Connect testing documentation (UK success bank 108800 / 00012345).

The preceding reversal fixture remains reversed. This new standalone bank-payout fixture does not represent another release of that job.

Fixture setup initially called transfer before the available balance was ready. Stripe cached the insufficient-balance response under its idempotency key. The revised attempt first checked available balance and absence of an existing bank-fixture transfer, then used a new key. This was test setup behavior, not evidence of a QuickGuard payout-handler failure. Both a bypass-pending PaymentIntent and a separate bypass-pending charge were created while diagnosing funding; unused sandbox balance remains on the platform.

## Application coverage limitation

Repository inspection found no payout.paid, payout.failed or payout.updated handling in QuickGuard's payment functions, nor application persistence of stripe_payout_id. Existing transfer.created handling records release to the connected Stripe account; it does not prove deposit to the bank. This test validates Stripe sandbox bank completion, not automatic QuickGuard reconciliation of bank-payout completion/failure.

Bank completion/failure tracking must be implemented and tested before claiming the application's full bank-payout lifecycle is complete. Hosted Express onboarding, finance-admin session and billing portal UI verification also remain outstanding as recorded in payment-lifecycle-uat-2026-10-04.md.

Temporary authenticated UAT helper disabled after verification. No production code changed during this check.
