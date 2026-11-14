# QuickGuard Supabase Security Advisor

Production review on 14 November 2026. Security Advisor reports two warnings and three informational findings. This review leaves production settings unchanged.

## pg_net registered in public

Production runs PostgreSQL 17.6 with pg_net 0.19.5, owned by supabase_admin. The connected postgres role is not a member of the owner role. The configured Data API schemas are app, storage and graphql_public. The net schema is outside that list. Seven active cron jobs and the guard application status trigger use database HTTP calls.

### Rehearsal evidence

Test Batabase completed a reinstall under extensions and a rollback to public using pg_net 0.20.4. The staging Edge Function logs show eight HTTP 200 responses in each of the baseline, reinstall and rollback phases. The eight synthetic callers represent support forwarding, finance snapshots, account retention, the email queue, overdue payouts, the application status notification, and daily and weekly digests. The rollback responses were also present in the database. All seven rehearsal schedules are disabled.

The echo endpoint verifies HTTP delivery. Each business workflow still needs a staging test against its own test destination. The test version differs from production. The monthly finance snapshot has a pre-existing failed run and needs its own baseline.

### Production preparation

1. Ask Supabase Support to confirm the owner-authorized reinstall path for pg_net 0.19.5 and whether the managed platform can supply an exact-version rehearsal environment. Avoid editing the extension catalog.
2. Rehearse on the production version with staging-only destinations. Verify each caller's application outcome and capture the Security Advisor result before and after the reinstall. Verify the rollback uses the same version and repeat the delivery checks.
3. For a production maintenance window, record the caller inventory and grants, pause affected schedules and coordinate application-status writes. Drain the queue and retain any required response evidence. A reinstall removes queued requests and stored responses.
4. Reinstall under extensions through the supported owner-authorized path. Verify worker health, grants, application notifications, queue handling and Security Advisor, then resume schedules. Use a controlled test event for payouts and email to avoid duplicate customer-facing actions. Roll back if a caller fails, permissions drift or requests stop draining.

[Supabase pg_net documentation](https://supabase.com/docs/guides/database/extensions/pg_net)

## Active admin helper executable by signed-in users

The flagged public.is_active_admin() helper has 51 direct policy dependencies and 15 matching routine bodies in the latest production inventory. The app copy has 42 direct policy dependencies and two matching routine bodies. Prior read-only production checks confirmed that an active admin with MFA could read the admin activity log. An admin without MFA and a normal client with MFA could not.

Prepare the change on a staging copy of the policies. Inventory both helpers, their grants and string-based callers before changing anything. If an unexposed helper is needed, preserve caller permissions for policy evaluation and update qualified routine references. Test signed-out access, ordinary client and guard access, admin without MFA, active admin with MFA, disabled admin and service-role operations. Verify representative admin reads and writes, customer-owned records, and affected billing and application workflows before comparing Advisor results. Keep the current grants in production until those checks pass.

[Supabase guidance on policy helpers](https://supabase.com/kb/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw)

## Informational findings

The advisor also reports RLS enabled with no policies on account_retention_events, support_email_dfp_outbox and support_inbound_emails. Check their worker access requirements before adding policies.
