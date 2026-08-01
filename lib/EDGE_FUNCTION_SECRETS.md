# QuickGuard — Edge Function Secrets

Every Supabase Edge Function and the secrets it requires.

To set a secret: Supabase Dashboard → Project → Edge Functions → Manage secrets.

---

## Universal (required by nearly every function)

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL (same as `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin-level DB access |

---

## Stripe

| Secret | Used By |
|---|---|
| `STRIPE_SECRET_KEY` | cancel-job, cancel-subscription, check-stripe-session, connect-guard-payout, create-connect-account, create-guard-payout, create-job-payment, create-subscription-checkout, create-wizard-checkout, dispute-job, enhanced-stripe-webhook, get-connect-status, list-stripe-products, release-guard-payment, resolve-dispute, resume-subscription, retry-failed-payment, stripe-webhook, sync-stripe-prices, update-after-payment |
| `STRIPE_WEBHOOK_SECRET` | enhanced-stripe-webhook, stripe-webhook |

---

## Email

| Secret | Used By | Notes |
|---|---|---|
| `RESEND_API_KEY` | create-guard-payout, process-email-queue, release-guard-payment, render-email-template | Resend API key for template-based emails |
| `SMTP_USER` | send-job-posted-email | Gmail SMTP username (TEMPORARY — migrate to Resend before scaling) |
| `SMTP_PASS` | send-job-posted-email | Gmail SMTP app password (TEMPORARY — migrate to Resend before scaling) |
| `FROM_EMAIL` | send-welcome-email, send-client-tier-email, send-guard-promo-welcome | Default sender address |
| `ADMIN_ALERT_EMAIL` | send-accessibility-feedback-email, send-admin-password-reset-alert, send-contact-form-email | Where admin notifications are sent |

---

## App / URLs

| Secret | Used By | Notes |
|---|---|---|
| `SITE_URL` | create-connect-account, release-guard-payment, and all send-* email functions | Used for redirect URLs and email links. Falls back to https://quickguard.uk if unset. |

---

## Geocoding

| Secret | Used By |
|---|---|
| `GOOGLE_GEOCODING_API_KEY` | geocode-address |

---

## Push Notifications

| Secret | Used By |
|---|---|
| `VAPID_PUBLIC_KEY` | get-vapid-public-key, send-push-notification |
| `VAPID_PRIVATE_KEY` | send-push-notification |
| `VAPID_SUBJECT` | send-push-notification (defaults to mailto:admin@quickguard.uk) |

---

## Webhooks / Admin

| Secret | Used By | Notes |
|---|---|---|
| `SIA_VERIFICATION_API_KEY` | sia-verification-webhook | API key for SIA background check webhook auth |
| `ADMIN_REGISTRATION_SECRET` | admin-register | Prevents unauthorized admin registration. MUST be >= 32 characters, long and random. Generate with `openssl rand -hex 32`. Anyone with this secret can create admin accounts. Never stored in database, never logged, never committed to repo. |
| `SUPABASE_ANON_KEY` | notify-matching-guards, register-magic-link, admin-register | Used for JWT validation in some functions |

---

## ADMIN_REGISTRATION_SECRET — Security Rules

- Server-side only — never exposed to frontend code or browser bundle
- Minimum 32 characters — shorter secrets rejected at function startup
- Generate: `openssl rand -hex 32`
- Never store in database
- Never log the actual value
- Never email the secret
- Never commit to git repo
- Rate limited: 3 failed attempts per IP per hour, 3 per email per hour
- Every attempt (success/failure) audited to `admin_registration_audit`
- Admin alerts on: successful registration, repeated failures triggering rate limit
- All error responses use identical safe message to prevent enumeration

---

## Gmail SMTP — Temporary Warning

`send-job-posted-email` currently uses direct Gmail SMTP (not Resend).

**Gmail SMTP is temporary for UAT/soft launch only. Migrate send-job-posted-email to Resend before scaling beyond early testing.**

**Why this is temporary:**
- Gmail enforces a ~500 emails/day sending limit
- The function has built-in protection: at 400 sends/day it fires an admin alert, at 475 it hard-rejects
- Failed sends after 3 retries trigger admin alerts
- All sends are logged to `public.email_send_log` for detailed audit
- Daily rollup counters in `public.email_provider_daily_usage`

**Safety limits:**
| Threshold | Action |
|---|---|
| 400/day | Admin warning alert: "Gmail email sending is approaching the daily limit. Migrate to Resend before scaling." |
| 475/day | Hard stop — all sends rejected with reason `gmail_daily_limit_reached`, critical admin alert |

**TODO before scaling:**
- Migrate `send-job-posted-email` to Resend (like all other email functions)
- Remove SMTP_USER / SMTP_PASS secrets after migration
- Keep `email_send_log` and `email_provider_daily_usage` tables for monitoring regardless of provider

---

## External Integrations

| Secret | Used By |
|---|---|
| `N8N_EMAIL_WEBHOOK_URL` | send-booking-confirmation |

---

## Quick Setup (copy-paste into Supabase Secrets UI)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_ANON_KEY=sb_publishable_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=hello@quickguard.uk
ADMIN_ALERT_EMAIL=admin@quickguard.uk
SITE_URL=https://quickguard.uk
GOOGLE_GEOCODING_API_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@quickguard.uk
SIA_VERIFICATION_API_KEY=...
ADMIN_REGISTRATION_SECRET=...
N8N_EMAIL_WEBHOOK_URL=https://...
```