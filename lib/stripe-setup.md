# Stripe Setup for QuickGuard

This project uses **Supabase Edge Functions** for all Stripe operations. No Next.js API routes are used.

## Live Edge Functions

| Function | Purpose |
|----------|---------|
| `create-wizard-checkout` | Creates a Stripe Checkout session after onboarding wizard submission |
| `check-stripe-session` | Checks payment status and activates the user's account after checkout |
| `enhanced-stripe-webhook` | Receives and processes Stripe webhook events |
| `sync-stripe-prices` | Syncs Stripe price/plan data into the local plans table |

## Required Edge Function Secrets

Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets and add:

```
STRIPE_SECRET_KEY              # Your Stripe secret key (sk_live_... or sk_test_...)
STRIPE_WEBHOOK_SECRET          # Stripe webhook signing secret (whsec_...)
SUPABASE_URL                   # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY      # Your Supabase service role key
```

**Important:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be set as **Supabase Edge Function secrets**, not as environment variables in `.env` or Vercel. This keeps Stripe keys server-side and secure.

## Required Stripe Webhook Events

Configure your Stripe webhook endpoint to listen for these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.payment_failed`

## Webhook Endpoint

```
https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/enhanced-stripe-webhook
```

Setup steps:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Click **Add endpoint**
3. Paste the URL above
4. Select all the events listed above
5. Click **Add endpoint**
6. Copy the **Signing Secret** (`whsec_...`)
7. Paste it into your Supabase Edge Function secrets as `STRIPE_WEBHOOK_SECRET`

## Live Plan Mapping (Price IDs)

Stripe Price IDs are now stored in the database (`app.plans` and `public.plans` tables). The Edge Functions read them dynamically from the database, so they stay in sync with your Stripe account.

**Do not hardcode Price IDs.** Instead:

1. Go to `/admin/stripe-sync` and click **Run Sync** to create Stripe Products/Prices and write their IDs into the database.
2. Or manually add them in the Supabase SQL Editor:

```sql
-- Example: update a plan's Stripe IDs
UPDATE app.plans
SET stripe_price_id = 'price_...',
    stripe_product_id = 'prod_...',
    stripe_annual_price_id = 'price_...'
WHERE slug = 'client-starter';

-- Also sync to public.plans
UPDATE public.plans
SET stripe_price_id = 'price_...',
    stripe_product_id = 'prod_...',
    stripe_annual_price_id = 'price_...'
WHERE slug = 'client-starter';
```

| Plan Slug | Audience |
|-----------|----------|
| `client-starter` | Client |
| `client-pro` | Client |
| `client-enterprise` | Client |
| `guard-basic` | Guard |
| `guard-pro` | Guard |
| `guard-elite` | Guard |

Plan slugs in the frontend must match the `app.plans` table and the checkout payload exactly.

## Checkout Flow

1. User completes the onboarding wizard (client or guard)
2. Frontend calls:
   ```
   POST ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-wizard-checkout
   ```
3. Payload:
   ```json
   {
     "userId": "uuid",
     "accountType": "client" | "guard",
     "planId": "client-starter" | "client-pro" | "client-enterprise" | "guard-basic" | "guard-pro" | "guard-elite",
     "userEmail": "user@example.com"
   }
   ```
4. Edge Function creates a Stripe Checkout session and returns `{ url: "..." }`
5. Frontend redirects the user to that `url`
6. After payment, Stripe redirects to `/payment/success?session_id=cs_test_...`
7. The success page calls:
   ```
   POST ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-stripe-session
   ```
8. The Edge Function verifies the session, updates the user's subscription status, and returns payment status + account info
9. The frontend redirects the user to their respective dashboard

## Testing Webhooks Locally

Use the Stripe CLI to forward webhook events to your local Supabase functions:

```bash
stripe listen --forward-to https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/enhanced-stripe-webhook
```

Or with a local Supabase tunnel:

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

## Security Notes

- All Stripe API calls happen inside Supabase Edge Functions — keys are never exposed to the browser
- The `enhanced-stripe-webhook` Edge Function verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET` before processing any event
- `SUPABASE_SERVICE_ROLE_KEY` is used inside Edge Functions to bypass RLS when updating user records after payment
- Do not create Next.js API routes (`app/api/stripe/...`) — all Stripe logic lives in Edge Functions