# QuickGuard — Stripe Live-Mode Cutover Checklist

**Status:** Stripe is currently in **Test mode** (`sk_test_...`).

This checklist is the precise, ordered procedure for switching to **Live mode** (`sk_live_...`) before accepting real payments. Follow every step in order. Do not skip the backup steps.

**Risk level:** High. Wrong keys = broken payments. A test key left in production = real charges landing in a sandbox. A live key in test = real charges during "testing".

---

## 0. Glossary — the two secret types (do not confuse them)

| Secret | Prefix | What it is | Where it goes |
|---|---|---|---|
| Secret key | `sk_live_...` (or `sk_test_...`) | Your Stripe API key — used to create charges, checkout sessions, etc. | `STRIPE_SECRET_KEY` in Supabase Edge Function secrets |
| Webhook signing secret | `whsec_...` | Verifies incoming webhook events are genuinely from Stripe | `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function secrets |

**Critical:** `sk_live_...` and `whsec_...` are completely different secrets and serve completely different purposes. Never swap them. Test-mode and live-mode each have their own pair — the live `whsec_...` is generated separately from the live `sk_live_...`, and must match the live webhook endpoint.

---

## 1. Pre-Cutover Checklist

Complete all of these in **Test mode** before touching any live keys.

- [ ] **1.1** Guard signup → earnings flow works end-to-end (guard registers, gets approved, is paid out — test payout lands in test Stripe).
- [ ] **1.2** Client signup → post job → payment flow works (client registers, posts a job, pays via Stripe Checkout test card).
- [ ] **1.3** Subscription creation works (client subscribes to a plan, test card charged).
- [ ] **1.4** Subscription renewal / recurring charge works (invoice.payment_succeeded fires, subscription stays active).
- [ ] **1.5** Webhook events are received and processed (check `processed_stripe_events` / `payment_events` tables show no backlog of failures).
- [ ] **1.6** `sync-stripe-prices` run in test mode successfully populated `app.plans` and `public.plans` with test price IDs.
- [ ] **1.7** **Backup the Supabase database.** Supabase Dashboard → Database → Backups → Create backup (or `pg_dump`). Note the timestamp.
- [ ] **1.8** **Export current test edge function secrets.** Go to Supabase Dashboard → Edge Functions → Manage Secrets, and copy out (to a password manager, not the repo) the current `sk_test_...`, `whsec_...`, and every other secret value so you can roll back.

---

## 2. Cutover Steps (in order)

1. Log into **Stripe Dashboard**.
2. In the top-right corner, toggle from **Test mode** to **Live mode**.
3. Copy your **live secret key** — it starts with `sk_live_...` (Developers → API keys).
4. Go to **Stripe Dashboard → Developers → Webhooks** (still in Live mode).
5. Click **Add endpoint** and create a new webhook for:
   ```
   https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/enhanced-stripe-webhook
   ```
   (Replace the host with your actual Supabase project URL if it differs.)
6. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Click **Add endpoint**, then copy the **Signing Secret** — it starts with `whsec_...` (NOT `sk_`).
8. In **Supabase Dashboard → Edge Functions → Manage Secrets**, update:
   - `STRIPE_SECRET_KEY` → the `sk_live_...` key from step 3
   - `STRIPE_WEBHOOK_SECRET` → the `whsec_...` signing secret from step 7
9. Run the **Stripe price sync** to pull live price IDs into the plans table: go to `/admin/stripe-sync` and click **Run Sync** (this writes `stripe_price_id`, `stripe_product_id`, `stripe_annual_price_id` into `app.plans` and `public.plans`).
10. **Verify** the live price IDs were written (spot-check `app.plans` / `public.plans` in the SQL editor — IDs should now start with `price_` from your live account, not your test account).
11. Test one full payment flow using Stripe's **test card** `4242 4242 4242 4242`, any future expiry, any CVC/ZIP. This validates the live pipeline end-to-end without moving real money.
12. Test one **subscription** flow (client subscribes → card charged on the schedule).
13. Do one real, low-value transaction (e.g. £1) to confirm real money settles correctly.

---

## 3. Verification

- [ ] **Stripe Dashboard → Payments**: the test transactions appear under the **Live** view (NOT under "Test Data" / test-mode toggle).
- [ ] **Supabase `transactions` / `payment_events` tables**: real transaction rows are logged.
- [ ] **Guard earnings** reflect the real payment (guard dashboard shows correct earnings from the live transaction).
- [ ] **Subscription** shows as active with a real (live) price ID.

---

## 4. Rollback (if needed)

If anything breaks after cutover:

1. **Revert secrets.** In Supabase Dashboard → Edge Functions → Manage Secrets, set:
   - `STRIPE_SECRET_KEY` → back to the `sk_test_...` value saved in step 1.8
   - `STRIPE_WEBHOOK_SECRET` → back to the test `whsec_...` value
2. **Remove the live webhook.** Stripe Dashboard → Developers → Webhooks → delete the live endpoint created in step 5.
3. **Restore the database backup** from step 1.7 if critical data was corrupted.
4. Re-run `/admin/stripe-sync` to restore test price IDs, then re-verify test-mode flows.

---

## 5. Post-Cutover Reminders

- Keep the test `sk_test_...` and `whsec_...` values in a password manager for future staging/testing — do not delete them.
- Never mix modes: a single webhook endpoint is either test or live. Keep them separate.
- Rotate `sk_live_...` only via Stripe Dashboard (roll keys), then immediately update `STRIPE_SECRET_KEY`.