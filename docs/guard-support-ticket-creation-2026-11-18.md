# Guard support-ticket creation — PR 143 refresh

The live support table required a client ID while the guard form sends its own guard ID and no client. PR 143 removes that required-client constraint and limits the guard insert path to an authenticated owner with a null client ID. The client complaint path can still associate a guard.

The refreshed admin view identifies the requester by the client when a client ID is present, otherwise by the guard. Both requester name and email appear in the list and detail; a client's contact name is the fallback when its company name is absent.

## Verification

- Reconciled the existing draft with main including PRs 158–160; the existing migration is retained under its original filename.
- Inspected the live columns, constraints, all ticket policies, grants and trigger definitions. The ticket table has no INSERT trigger; the existing owner-update protection is retained.
- PostgreSQL regression coverage reproduces the missing-client failure before migration, then checks guard-owned creation/read, cross-account/anonymous/ownerless insert denial, unrelated-client attachment denial, client complaints, closed-account restrictions, protected owner updates, admin/service access and migration reapplication.
- Admin-loader and rendered list/detail checks distinguish guard requesters from client complaints and display the correct contact email.

No support email or DFP Command delivery is enabled by this change. The existing bridge's batch selects only tickets with a client ID; guard tickets remain in QuickGuard. Signed-in browser UAT remains a separate release check after frontend publication.

## Deployment

Apply `20261114105009_enable_guard_support_ticket_creation.sql` once through the migration mechanism, verify schema/policies and rolled-back owner-scope probes, then import merged main into Readdy and publish the requester display. No Edge Function deployment is required. Existing guard form submissions already use the intended payload.

Rollback of the nullable-client change requires first checking for guard-only tickets; never restore NOT NULL over valid guard tickets or delete them to force a rollback.
