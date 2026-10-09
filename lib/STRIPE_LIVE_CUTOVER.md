# QuickGuard — Stripe live cutover runbook

**Current state:** QuickGuard is connected to a Stripe sandbox/test account. Test-mode objects and IDs cannot be used in live mode.

**Change risk:** High. Use a planned maintenance window, one named operator, one verifier, and a written timestamped change log. Do not accept a real payment until every pre-cutover item passes.

## 1. Secrets and mode map

| QuickGuard location | Value in sandbox | Value at live cutover | Purpose |
|---|---|---|---|
| Supabase Edge Function secret `STRIPE_SECRET_KEY` | `rk_test_...` or `sk_test_...` | Prefer least-privilege `rk_live_...`; use `sk_live_...` only if the restricted key has not passed testing | Server-side Stripe API access |
| Supabase Edge Function secret `STRIPE_WEBHOOK_SECRET` | Test endpoint `whsec_...` | Live **platform** endpoint `whsec_...` | Verifies events delivered to `enhanced-stripe-webhook` |
| `app.bank_payout_webhook_keys` | Active test signing-secret row with `livemode=false` | Active live **connected-account** signing-secret row with `livemode=true` | Verifies bank-payout events delivered to `stripe-bank-payout-webhook` |

QuickGuard does not currently use a Stripe publishable key in the browser. Do not add one for this cutover.

Never put an `sk_`, `rk_`, or `whsec_` value in source control, tickets, chat, screenshots, logs, or SQL checked into the repository. Keep recoverable copies in the approved password manager/secrets vault. Supabase may show only secret names after values are stored.

## 2. Pre-cutover — complete in test mode

- [ ] Confirm the Stripe live account is activated and business details, public business information, branding, support contact, statement descriptor, settlement bank account, tax settings, fraud controls, team access, and strong 2FA are reviewed.
- [ ] Confirm Stripe Connect is enabled for the platform and the live Express-account configuration is ready.
- [ ] Complete the full sandbox flow: client signup → job → Checkout → webhook → funded job → completion approval → transfer → connected-account bank payout.
- [ ] Complete subscription create, renewal, failed-payment, cancellation, refund, and dispute tests.
- [ ] Verify the webhook event log has no unexplained failures or retry backlog.
- [ ] Test a least-privilege `rk_test_...` key first. Review Stripe Workbench request logs, grant only required permissions, and resolve every 403 before creating the equivalent live restricted key.
- [ ] Record the current sandbox Stripe account ID, endpoint IDs, test product/price IDs, and the affected QuickGuard record IDs.
- [ ] Export a database backup and a separate mapping export for all Stripe-linked columns, including customer, subscription, product, price, connected-account, Checkout Session, PaymentIntent, transfer, and payout IDs.
- [ ] Confirm the current test secret values are recoverable from the approved secrets vault. If they are not, rotate them and test the replacements before cutover.
- [ ] Confirm a rollback operator can restore the **mapping export** without overwriting new business data.
- [ ] Put QuickGuard into maintenance/payment freeze. Block new Checkout Sessions, subscription changes, Connect onboarding, transfers, and payout actions during the switch.

## 3. Live objects must be created or re-onboarded

Stripe objects are mode-specific. Never copy a sandbox object ID into live configuration.

- [ ] Clear or replace sandbox `stripe_customer_id` values so live Customers are created in the live account.
- [ ] Archive/reconcile sandbox subscription records and clear sandbox `stripe_subscription_id` references. Customers must start a new live subscription; test subscriptions do not become live subscriptions.
- [ ] Run QuickGuard's Stripe plan sync in live mode. Verify all six paid plans have a live Product plus monthly and annual live Price IDs in every plan table used by the app.
- [ ] Clear sandbox guard `stripe_account_id` references and require each payout-enabled guard to complete Stripe-hosted onboarding for a new live connected account. A test connected account cannot receive live transfers.
- [ ] Keep the exported sandbox mappings; do not delete the evidence needed for reconciliation or rollback.

## 4. Create the two live webhook destinations

### 4.1 Platform endpoint

Create a live webhook destination for:

```text
https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/enhanced-stripe-webhook
```

Subscribe to exactly the events the deployed handler processes:

- `account.updated`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.payment_failed`
- `transfer.created`
- `transfer.updated`
- `transfer.reversed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

Reveal that endpoint's live signing secret once and store it as Supabase secret `STRIPE_WEBHOOK_SECRET`.

### 4.2 Connected-account bank-payout endpoint

Create a separate **Connect / events on connected accounts** live destination for:

```text
https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/stripe-bank-payout-webhook
```

Subscribe to:

- `payout.created`
- `payout.updated`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

Add its signing secret to `app.bank_payout_webhook_keys` using the approved secure admin procedure with the live endpoint ID, `livemode=true`, and `active=true`. Do not reuse the platform endpoint secret. Keep the test row available for rollback until live verification is complete.

## 5. Ordered cutover

1. Record the start time and confirm the maintenance/payment freeze.
2. Take the final database backup and Stripe-ID mapping export.
3. In Stripe live mode, create the products/prices, platform webhook destination, connected-account webhook destination, and least-privilege live restricted key.
4. Store the live `STRIPE_WEBHOOK_SECRET`.
5. Store the live `STRIPE_SECRET_KEY`.
6. Add and activate the live `app.bank_payout_webhook_keys` row; do not deactivate the test row yet.
7. Reset sandbox customer, subscription, connected-account, product, and price mappings according to section 3.
8. Run the live plan sync and verify all live IDs in both QuickGuard plan tables.
9. Deploy/restart Edge Functions if required for refreshed secrets, then run launch readiness. `stripe_mode` must pass.
10. Use Stripe Dashboard's webhook test delivery for every subscribed event family and verify successful signature checks and idempotent processing.
11. Complete live Stripe-hosted onboarding for one real guard and verify `account.updated` reaches QuickGuard.
12. Make one genuine low-value live job payment with a real payment method. **Do not use Stripe test card numbers in live mode.**
13. Verify the job remains unfulfilled while an asynchronous payment is unpaid, then confirms only after `checkout.session.async_payment_succeeded`. Verify the failure path with a test-mode simulation before cutover; never deliberately fail a real card.
14. Verify the live Payment, Checkout Session, Customer, QuickGuard transaction, funded job, assignments, client notification, guard notification, and confirmation emails all agree.
15. Complete and approve the job, create the live transfer to the onboarded guard, and verify transfer events.
16. Verify the connected account's real bank payout and each `payout.*` event through the separate connected-account endpoint.
17. Create one genuine low-value live subscription and verify its live Customer, Subscription, Price, invoice, webhook processing, and access level.
18. Have the second operator reconcile amounts, fees, currency, IDs, and timestamps.
19. Remove the maintenance/payment freeze only after all critical checks pass.
20. After the observation window, deactivate obsolete test webhook-key rows in production configuration. Keep sandbox credentials only in the secrets vault for isolated future testing.

## 6. Go/no-go checks

Do not open payments unless all are true:

- [ ] `STRIPE_SECRET_KEY` is a live server-side key and launch readiness reports live mode.
- [ ] The platform endpoint and connected-account endpoint are both live, enabled, and returning 2xx.
- [ ] Their two signing secrets are stored in the correct locations and are not swapped.
- [ ] Every live Product/Price ID belongs to the live account.
- [ ] No Customer, Subscription, connected-account, Checkout, PaymentIntent, transfer, or payout record depends on a sandbox ID.
- [ ] At least one real guard has completed live Connect onboarding.
- [ ] A genuine low-value payment, subscription, transfer, and payout reconcile end to end.
- [ ] Receipt/confirmation email delivery is verified in the email provider and the recipient inbox.

## 7. Safe rollback

Stop new Checkout, subscription, onboarding, transfer, and payout actions first.

1. Record all live Stripe objects and QuickGuard rows created since cutover.
2. Reconcile or refund/cancel live Payments, Subscriptions, Transfers, and Payouts as appropriate in Stripe. Do not orphan real-money activity.
3. Restore the test `STRIPE_SECRET_KEY` and test platform `STRIPE_WEBHOOK_SECRET`.
4. Activate the test bank-payout webhook-key row and deactivate the live row.
5. Disable the live webhook destinations; do not delete them until the incident record is complete.
6. Restore only the exported sandbox Stripe-ID mappings and plan mappings needed to resume test mode.
7. Re-run the test plan sync and the full sandbox smoke test.
8. Keep live transaction/audit records intact for accounting and incident review.

**Never restore a whole pre-cutover database over records created after real payments began.** A full restore can disconnect money movements from QuickGuard's ledger. Use a point-in-time restore only under an incident plan that preserves and reconciles all post-cutover live activity.

## 8. Change-control notes

- Keep Stripe SDK/API-version upgrades out of the cutover change. Test and deploy those separately.
- Rotate/expire any temporary full-access live key after the restricted key has passed production verification.
- Apply Stripe key IP restrictions where the hosting model supports stable egress.
- Require passkeys or authenticator-app 2FA for Stripe Dashboard users.

## Official Stripe references

- [Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- [API keys and restricted keys](https://docs.stripe.com/keys)
- [API key security](https://docs.stripe.com/keys-best-practices)
- [Webhook signatures and delivery](https://docs.stripe.com/webhooks)
- [Connect webhooks](https://docs.stripe.com/connect/webhooks)
- [Testing](https://docs.stripe.com/testing)
- [Express connected accounts](https://docs.stripe.com/connect/express-accounts)
- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
