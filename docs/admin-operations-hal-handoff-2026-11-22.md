# QuickGuard HAL worker repair handoff — 22 November 2026

Continue the authorised QuickGuard admin repairs from this repository. Production project: `vnywjfpkepjgclkbcmsj`. The separate approved recovery target is `dnbvybmulsppfjntbsxz` in Frankfurt; its private `qg_recovery_20261122` schema is a core-data drill, not a live application database.

## Scope and workflow identity

Inspect current exports on HAL before editing. Preserve credentials, schedules, activation state, unrelated nodes, workflow IDs and webhook contracts. Keep private exports/backups outside git. Do not overwrite n8n's SQLite database while it is running.

| Workflow | HAL ID | Confirmed finding |
| --- | --- | --- |
| QuickGuard Payout Agent v01 | `TG4JyKI67D1Fro4b` | Checks booking confirmation for completion approval |
| QuickGuard Job Monitoring Agent v01 | `6LMw86OKAGurTJv3` | Historic UAT/dispute states still require classification/review |
| QuickGuard SIA Verification Agent v01.1 | `adtv1EnDe1eblBED` | Treats account activity as marketplace eligibility |

Do not move money, retry payouts, issue refunds, change eligibility, fabricate attendance/approval timestamps, or replace worker telemetry with green snapshots. Do not suppress findings solely because a job title contains UAT. Do not send messages to third parties. Genuine disputes, expired verified licences, duplicate transfers and missing payment evidence must remain visible.

## Payout patch already prepared and tested locally

`scripts/ops/patch-payout-worker.cjs` accepts a current n8n JSON export and writes a separate private export. It refuses unexpected workflow identity, changed reasoning anchors, existing patches or changed connection wiring. It was exercised against the original September pack and against a reduced, in-memory copy of the restored November core snapshot. No workflow was executed and no money moved.

```bash
node scripts/ops/patch-payout-worker.cjs CURRENT-PAYOUT-EXPORT.json PATCHED-PAYOUT-EXPORT.json
```

Review the diff before applying through the supported n8n API/UI. If current source differs, inspect and adapt the actual workflow instead of forcing the patch. The new completion read must stop on HTTP errors. Check pagination if the live workflow uses a limited page; missing evidence must never produce a healthy approval result.

Canonical completion evidence lives in `app.job_completion_requests`, matched on `job_id`, `guard_id` and `client_id`, with `status='approved'` and a valid client/admin/auto approval timestamp preceding payout initiation. The table has **no `assignment_id` column**. `jobs.client_confirmed` is booking confirmation and cannot authorise completion or payout.

Three live RED findings were independently checked: assignments `8021d1d8-4a6c-4222-84b9-becc50e90e8f`, `46073cf6-8290-4236-a38a-610b997babc0`, and `d99b7467-3b5c-4680-a24f-9dddfb566ace`. Each has client approval several seconds before its payout-release timestamp on 8–9 October. Preserve tests that still raise critical findings for missing, mismatched, disputed, invalid or late approval.

## Job monitor and unfinished assignments

The five unassigned expired launch adverts have already been closed with an audit trail by `scripts/ops/20261122-retire-uat-adverts.sql`; one pending application was retained. Do not reopen or delete them.

Review the two chargeback UAT jobs `726f86b4-e8a5-4a3e-907e-3a2d1facbd25`, `626f86b4-e8a5-4a3e-907e-3a2d1facbd25`, and the open client-dispute job `826f86b4-e8a5-4a3e-907e-3a2d1facbd25`. They have financial/dispute evidence; preserve those holds. Monitoring should report held/disputed cases accurately rather than demand attendance or payment release for a blocked case.

Review old confirmed assignments `8b7ecedb-2829-4954-a627-025f2d13533a`, `6f837b43-416f-4a41-beb5-f89b5d97da11`, and `0b9325dc-e26c-4c60-82a8-47161a2d7110` against audit/payment records. Their scheduled dates have passed without attendance evidence. Do not claim completion. Any cancellation must follow the existing cancellation/refund contract; document cases needing a business decision.

## SIA monitor

Separate pending onboarding, marketplace eligibility and account activity. `is_active=true` alone does not mean a guard is approved to work. Retain alerts for verified/eligible guards with expired licences, mismatched identity, inconsistent verification state, missing required documents or administrative overrides. Use current canonical eligibility logic and actual HAL source. Do not approve/reject real guards or alter SIA records merely to clear alerts.

## Verification and handback

Run the changed reasoning with synthetic cases before deployment. Keep previous exports for rollback. After deployment, wait for a scheduled heartbeat and verify new timestamps, findings and counts in `app.agent_state_snapshots`. Report genuine remaining alerts explicitly. Do not invoke downstream money-moving or communication actions while testing reasoning. Record workflow IDs, deployment time, diff, test evidence and remaining blockers.

The sandbox £80 reversed transfer was already reconciled against Stripe and audited, without retrying it. Its failed state remains intentionally visible. See `scripts/ops/20261122-record-sandbox-reversal-review.sql` and `docs/payment-lifecycle-uat-2026-10-04.md`.
