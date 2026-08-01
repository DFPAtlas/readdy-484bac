# QuickGuard — Soft Launch Notes

## Launch Status

**Date:** 2026-06-16
**Target:** Soft launch (early users, controlled rollout)
**Launch checklist:** `/admin/go-live-checklist`

Use the go-live checklist in the admin dashboard to track readiness. Score is calculated automatically as items are checked off.

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Gmail SMTP daily cap (~500/day) | High | 400 warn / 475 hard stop in send-job-posted-email. Migrate to Resend before scaling. |
| Stripe live mode not yet switched | High | All Stripe test mode flows verified. Switch to live keys only after final sign-off. |
| No automated backup schedule | Medium | Manual Supabase backup taken. Set up pg_dump cron or Supabase automated backups. |
| rate_limit_events / audit tables grow unbounded without TTL | Low | pg_cron TTL purge active for rate_limit_events (7 days). Extend to admin_registration_audit and email_send_log if needed. |
| Admin registration secret is static | Medium | Rotate periodically via openssl rand -hex 32. |
| No automated uptime monitoring confirmed | Medium | Add external monitoring (e.g. UptimeRobot, Better Uptime) before going live. |
| No dedicated error tracking (Sentry, etc.) | Low | Console logs only. Add error tracking before scaling. |

---

## Gmail Temporary Warning

**Gmail SMTP is temporary for UAT/soft launch only.**

- Only send-job-posted-email uses Gmail. All other emails use Resend.
- Limits in place: 400/day warning alert, 475/day hard stop.
- Track daily usage in email_provider_daily_usage table.
- **TODO: Migrate send-job-posted-email to Resend before scaling production email volume.**

---

## Stripe Live Mode Warning

**Stripe is currently in test mode.**

Before accepting real payments:
1. Replace test keys with live keys in Supabase edge function secrets.
2. Configure Stripe live webhook endpoint in Stripe dashboard.
3. Re-verify all payment flows with live keys.
4. Update STRIPE_SECRET_KEY in edge function secrets.

---

## Backup / Rollback Reminder

**Before going live:**
1. Take a full Supabase database backup.
2. Export all edge function source code.
3. Save the current production environment variables snapshot.
4. Keep the previous migration files accessible.

**Rollback plan:**
1. Restore Supabase database from backup.
2. Redeploy previous edge function versions.
3. Revert environment variable changes.
4. Run build to verify.

---

## Emergency Admin Contacts

Store these outside the codebase (password manager, shared doc):
- Supabase project owner credentials
- Stripe dashboard access
- Domain registrar (quickguard.uk) access
- Gmail SMTP app password rotation
- ADMIN_REGISTRATION_SECRET

---

## Post-Launch Monitoring Steps

1. **Daily:** Check email_provider_daily_usage for Gmail send counts.
2. **Daily:** Review admin_alerts for any critical warnings.
3. **Daily:** Check failed_subscription_payments and failed_transactions.
4. **Weekly:** Review admin_registration_audit for suspicious attempts.
5. **Weekly:** Review rate_limit_events for abuse patterns.
6. **Monthly:** Audit RLS policies — no regressions.
7. **Monthly:** Rotate ADMIN_REGISTRATION_SECRET.