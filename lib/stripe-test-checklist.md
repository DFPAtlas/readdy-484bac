# Stripe Integration Test Checklist

## Pre-requisites

Before testing, ensure these Supabase Edge Function secrets are set:
- `STRIPE_SECRET_KEY` — your test key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — signing secret from Stripe webhook endpoint (`whsec_...`)
- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_ROLE_KEY` — your service role key

---

## Step 1: Confirm Plans Are Synced

1. Open the Supabase SQL editor and run:
   ```sql
   SELECT slug, name, stripe_price_id, stripe_product_id 
   FROM public.plans WHERE active = true ORDER BY slug;
   ```
2. Verify all plans have non-null `stripe_price_id` values starting with `price_`.
3. If any are null → go to `/admin/stripe-sync` and click **Run Sync**.

---

## Step 2: Create a Checkout Session

1. Register a new guard or client test account.
2. Complete the profile wizard and select a plan.
3. Click **Subscribe & Start Working / Subscribe & Start Hiring**.
4. Expected: browser redirects to `https://checkout.stripe.com/...`
5. If error → check Supabase Edge Function logs for `create-wizard-checkout`.

---

## Step 3: Pay with Stripe Test Card

On the Stripe Checkout page:
- Card number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g. `12/34`)
- CVC: Any 3 digits (e.g. `123`)
- Postcode: Any (e.g. `SW1A 1AA`)

Click **Subscribe**.

Expected: Stripe redirects to `/subscription/success?session_id=cs_test_...`

---

## Step 4: Confirm Webhook Received

1. In Stripe Dashboard → **Developers → Webhooks** → click your endpoint.
2. Check these events arrived and returned `200`:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`
3. In Supabase → **Edge Functions → Logs** for `enhanced-stripe-webhook`.
4. Expected log: `[Webhook] Activated subscription for guard/client user <uuid>, plan <slug>, status trialing`

---

## Step 5: Confirm Supabase Updated

```sql
-- Check subscriptions table
SELECT user_id, plan_slug, status, stripe_subscription_id, stripe_customer_id 
FROM app.subscriptions 
ORDER BY created_at DESC LIMIT 5;

-- Check guards table
SELECT user_id, subscription_status, subscription_plan, 
       stripe_customer_id, stripe_subscription_id, onboarding_status
FROM app.guards 
WHERE updated_at > NOW() - INTERVAL '10 minutes';

-- Check clients table
SELECT user_id, subscription_status, subscription_plan,
       stripe_customer_id, stripe_subscription_id
FROM app.clients
WHERE updated_at > NOW() - INTERVAL '10 minutes';
```

Expected:
- `subscription_status`: `trialing` (or `active`)
- `stripe_customer_id`: `cus_...`
- `stripe_subscription_id`: `sub_...`
- `onboarding_status` (guards): `active`

---

## Step 6: Confirm Dashboard Unlocks

1. After success page, you should land on `/guard/dashboard` or `/client/dashboard`.
2. If redirected back to pricing → `subscription_status` was not updated.
3. Refresh `/subscription/success?session_id=<id>` — will re-attempt the update.

---

## Step 7: Test Failed Payment

Use test card `4000 0000 0000 0341` (attaches but first payment fails):
- Expected: `subscription_status → past_due` in Supabase
- Notification "Payment Failed" inserted into `app.notifications`

---

## Step 8: Idempotency Check

1. In Stripe Dashboard → resend a `checkout.session.completed` event.
2. Expected: returns `200` with `{ received: true, idempotent: true }`
3. Check `app.processed_events` — event ID appears only once.

---

## Webhook Endpoint

Use `enhanced-stripe-webhook` for all Stripe webhook events:

```
https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/enhanced-stripe-webhook
```

The deprecated `stripe-webhook` function must not be used in production.

## Required Webhook Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.payment_failed`

---

## Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Could not resolve a valid Stripe price" | Plan has no valid `stripe_price_id` | Run Stripe Sync at `/admin/stripe-sync` |
| Webhook 400 "No signature" | Wrong webhook secret | Update `STRIPE_WEBHOOK_SECRET` in Supabase secrets |
| Supabase not updated | Webhook not reaching endpoint | Add endpoint in Stripe Dashboard |
| Dashboard still locked | `subscription_status` not updated | Revisit the success URL to retry |
| Duplicate subscription records | Idempotency check is working | Normal — `processed_events` prevents duplicates |