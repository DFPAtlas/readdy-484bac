# QuickGuard — Production Env Checklist

Pre-launch verification for every environment variable and secret.

---

## 1. Vercel / Hosting Env Vars

These go in your hosting dashboard (Vercel → Project → Settings → Environment Variables).

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ☐ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ☐ | Public anon/publishable key (safe for frontend) |
| `NEXT_PUBLIC_SITE_URL` | ☐ | https://quickguard.uk (or your domain) |
| `NEXT_PUBLIC_APPLE_AUTH_ENABLED` | ☐ | false unless Apple OAuth is configured |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | ☐ | n8n webhook for SIA checks |
| `GOOGLE_GEOCODING_API_KEY` | ☐ | Google Maps Geocoding API key |

---

## 2. Supabase Edge Function Secrets

Supabase Dashboard → Project → Edge Functions → Manage secrets.

| Secret | Status | Notes |
|---|---|---|
| `SUPABASE_URL` | ☐ | Same value as NEXT_PUBLIC_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ☐ | NEVER put this in frontend code |
| `SUPABASE_ANON_KEY` | ☐ | Same as NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `STRIPE_SECRET_KEY` | ☐ | Use sk_live_... for production, sk_test_... for testing |
| `STRIPE_WEBHOOK_SECRET` | ☐ | From Stripe webhook endpoint (see section 3) |
| `RESEND_API_KEY` | ☐ | Resend API key |
| `SMTP_USER` | ☐ | Gmail address for send-job-posted-email (TEMPORARY) |
| `SMTP_PASS` | ☐ | Gmail app password, NOT account password (TEMPORARY) |
| `FROM_EMAIL` | ☐ | hello@quickguard.uk |
| `ADMIN_ALERT_EMAIL` | ☐ | Where admin notifications go |
| `SITE_URL` | ☐ | https://quickguard.uk |
| `GOOGLE_GEOCODING_API_KEY` | ☐ | Duplicate from hosting env for edge function access |
| `VAPID_PUBLIC_KEY` | ☐ | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | ☐ | Web push VAPID private key |
| `VAPID_SUBJECT` | ☐ | mailto:admin@quickguard.uk |
| `SIA_VERIFICATION_API_KEY` | ☐ | API key for SIA webhook auth |
| `ADMIN_REGISTRATION_SECRET` | ☐ | Must be >= 32 chars, generate with openssl rand -hex 32 |
| `N8N_EMAIL_WEBHOOK_URL` | ☐ | n8n email webhook for booking confirmations |

---

## 3. Stripe Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Create endpoint pointing to: https://[your-project].supabase.co/functions/v1/enhanced-stripe-webhook
3. Events: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_succeeded/failed
4. Copy the Signing Secret (whsec_...) → set as STRIPE_WEBHOOK_SECRET

Test mode vs Live mode:
- Test mode: use sk_test_... and test webhook signing secret
- Live mode: use sk_live_... and live webhook signing secret
- These are DIFFERENT secrets — make sure they match

---

## 4. Safety Verification

| Check | Status |
|---|---|
| No SUPABASE_SERVICE_ROLE_KEY in frontend code | ✅ |
| No hardcoded Supabase URL in code | ✅ |
| No STRIPE_SECRET_KEY in frontend | ✅ |
| No Stripe test keys committed to repo | ✅ |
| No RESEND_API_KEY in frontend | ✅ |
| .env is gitignored | ☐ |

---

## 5. Post-Deployment Verification

- [ ] Visit homepage — no build errors
- [ ] Sign up a guard — magic link arrives
- [ ] Sign up a client — magic link arrives
- [ ] Post a job — appears in DB
- [ ] Stripe checkout — redirects successfully
- [ ] Stripe webhook — payment reflected
- [ ] Admin login — /admin/dashboard loads
- [ ] Geocoding — address resolves
- [ ] Push notifications — test arrives
- [ ] SIA verification webhook — accepted

---

## 6. Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| send-job-posted-email uses Gmail SMTP | Medium | 500/day limit, 400 warn / 475 stop. Migrate to Resend before scaling. |
| SMTP_PASS is Gmail app password | Low | Rotate periodically. |
| ADMIN_REGISTRATION_SECRET must be strong | High | >= 32 chars, openssl rand -hex 64 recommended. |
| Stripe test/live mode mismatch | High | Double-check keys match mode. |

---

## 7. .gitignore Safety

Verify .gitignore includes:
```
.env
.env.local
.env.*.local
*.pem
```