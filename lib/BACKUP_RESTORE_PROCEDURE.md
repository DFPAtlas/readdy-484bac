# QuickGuard Database Backup & Restore

## Automated Backups

- Enabled on Supabase project: quickguard.uk
- Frequency: Daily at 2 AM UTC
- Retention: 7 days by default (can upgrade to 30 days on a higher plan)
- Location: Supabase Dashboard → Project → Settings → Backups

## Manual Backup

To take a manual backup before a risky operation:

1. Supabase Dashboard → Backups → "Create a new backup"
2. Name: `quickguard_[operation]_[DATE]` (e.g. `quickguard_stripe_livecutover_2026-08-20`)
3. Wait for completion
4. Note the backup ID

## Restore Procedure

### If data is corrupted or deleted

1. Supabase Dashboard → Backups
2. Find the backup to restore from (e.g. yesterday's automated backup)
3. Click "Restore" — this creates a **new** project with the backup data; it does not overwrite production
4. Test the restored project thoroughly
5. Once verified:
   - Update DNS to point to the restored project, OR
   - Export data from the restored project and import it into the production project
6. Verify all services (frontend, edge functions, admin) work after restore

### If you need a point-in-time restore in production

- Contact Supabase support for guidance (available on Advanced plans)
- Have your pre-launch backup ID ready

## Pre-Launch Backup

- Name: `quickguard_pre_launch_2026-08-16`
- Backup ID: stored in 1Password / secure notes
- Contents: full schema, all seed data, admin users, payment records

## Test Restore Schedule

- Every quarter: restore from backup to a test project and verify all flows work
- Document results and any issues found

## Long-term Strategy

- If the database exceeds ~1GB, upgrade to Supabase Advanced for more backup retention
- Set a recurring calendar reminder: quarterly backup restore test

## Disaster Quick Reference

| Scenario | Action |
| --- | --- |
| Accidental delete / data corruption | Restore yesterday's automated backup to a new project, verify, then cut over |
| Full production failure | Contact Supabase support, have pre-launch backup ID ready |
| Before any risky migration | Take a named manual backup first |