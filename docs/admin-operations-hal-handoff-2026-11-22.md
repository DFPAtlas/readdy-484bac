# QuickGuard HAL worker repair handoff — 22 November 2026

Continue the authorised QuickGuard admin repairs from this repository. Production project: `vnywjfpkepjgclkbcmsj`. The separate approved recovery target is `dnbvybmulsppfjntbsxz` in Frankfurt; its private `qg_recovery_20261122` schema is a core-data drill, not a live application database.

## Client Selection and Job Funding repair, 13:57 UTC

The 13:52 UTC RED snapshots had two Client Selection critical findings and eight Job Funding critical findings, all on the same two October chargeback fixtures. Fresh production read-back confirmed that job `726f86b4-e8a5-4a3e-907e-3a2d1facbd25` had a lost chargeback and job `626f86b4-e8a5-4a3e-907e-3a2d1facbd25` had a won chargeback. Both remain confirmed, funded and dispute-flagged, with no assignment or application. Each has a completed GBP 88 original payment, an agreed amount of GBP 80 and a recorded client charge total of zero. The audit requires finance review for both outcomes.

Both monitors now classify recorded dispute holds before applying active-booking selection and assignment rules. The hold findings retain the outcome and record counts. Funding emits one missing-assignment finding per undisputed active job and continues to check a held booking for genuine payment issues. It uses a positive recorded client charge total and comparable currency and amount for reconciliation. A missing client total is a warning requiring evidence. A mismatch against a recorded total, currency mismatch, duplicate payment, and a funded job without completed payment evidence still raise findings.

| Workflow ID | Published version | Published UTC, 22 Nov | Scheduled run | Snapshot ID | Snapshot UTC, 22 Nov | Verified counts |
| --- | --- | --- | --- | --- | --- | --- |
| Client Selection `HkKkrBniZ8R5g3q3` | `29b37736-816c-4ef7-8870-8d2a9469a418` | 13:54:39.040 | `378754` | `1d78d224-c031-45e6-bd99-56a957479ce1` | 13:57:03.630 | AMBER, 5 jobs, 13 applications, 17 assignments, 22 guards, 2 hold warnings, 0 critical |
| Job Funding `aBj0Oc0NBWlzYCuh` | `673079dc-03cd-42ff-8768-0ec7a6b76a9c` | 13:54:39.175 | `378759` | `adac063b-c927-4c58-acd5-0ccbb54a63b7` | 13:57:04.143 | AMBER, 5 jobs, 12 selected applications, 17 assignments, 19 transactions, 2 hold warnings, 2 reconciliation warnings, 0 critical |

Nine focused tests passed on Node 22. Fixtures covered won and lost holds, real undisputed selection gaps, missing and duplicate payment evidence, genuine amount and currency mismatches, failed job reads, and preservation of workflow wiring and schedules. Both scheduled job reads returned HTTP 200. Other reader outputs matched the persisted counts. The runs saved fresh rows in `app.agent_state_snapshots`.

Finance still needs the original checkout or payment-provider evidence to establish the intended client charge on each job. The GBP 8 difference between the recorded payment and agreed amount remains unreconciled. Operations and finance still need to decide the disposition of both bookings. The repair left the dispute holds and original payment records in place.

### Selection and funding rollback

Private API exports are on HAL in `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/selection-funding/backup-20261122T135401Z/`.

| Export | Original active version |
| --- | --- |
| `HkKkrBniZ8R5g3q3.json` | `9b364846-24f3-4953-9338-042d2eabcd75` |
| `aBj0Oc0NBWlzYCuh.json` | `1f1b8995-eddb-4c93-bb15-0db21117bc21` |

The parent directory contains `manifest.json` with backup checksums, per-workflow diffs, `focused.log` and `verification.json`. Check for intervening changes before restoring the affected workflow definition to the same ID through the supported n8n API or UI. Verify the active version and the next scheduled snapshot.

## Worker query and Master telemetry repair, 13:42 UTC

The four published versions below retained their workflow IDs, active state, five-minute schedules, credential references and downstream contracts. The repairs changed monitoring reads and reasoning. No payment, dispute, assignment, guard verification or eligibility record was edited.

| Workflow | Published version | Published UTC, 22 Nov | Scheduled run | Snapshot ID | Snapshot UTC, 22 Nov | Verified inputs and health |
| --- | --- | --- | --- | --- | --- | --- |
| Review & Reputation `8M4HAkmigFxAH7ck` | `968f0d6c-36da-48ff-8a01-81c4a9d796f3` | 13:38:38.929 | `378706` | `f0b0e1de-9043-49c5-9c0e-aa3ad795fa11` | 13:42:02.806 | 22 guards, AMBER |
| Diagnostics & Recovery `Mz39wYS4Fewhyvs0` | `e7141d58-d800-4528-8fea-c13057641795` | 13:38:39.079 | `378711` | `a9b9ffa8-ea22-4fd8-b48f-b291f631761b` | 13:42:04.004 | 0 registry rows, 500 snapshots, RED |
| QuickGuard Master `hd2rIh2umh83tydj` | `c912df68-838d-46ec-b2d7-468052837911` | 13:38:39.208 | `378716` | `7d070bed-8a2a-4b56-af51-5bb4596ecb21` | 13:42:04.540 | 0 registry rows, 500 snapshots, AMBER |
| SIA Verification `adtv1EnDe1eblBED` | `4d0cf731-d17a-4bef-afe1-48dcdd1303bc` | 13:38:39.353 | `378715` | `8552fb78-e6a3-4e00-849c-57085960881f` | 13:42:04.206 | 4 active assignments, all after the cutoff, AMBER |

All ten focused tests passed on Node 22. Fixtures covered valid inputs, empty HTTP 200 responses, PostgREST errors, invalid response shapes, stale and missing telemetry, canonical URLs, and preserved schedules and downstream nodes. Direct read-only checks and normal scheduled executions confirmed the repaired queries. Each affected scheduled input returned HTTP 200 and its count matched the persisted snapshot. The saved executions contained no SQLSTATE `42703` errors.

- Review uses `rating`, `total_reviews`, and `total_jobs_completed` from the guard record. Unavailable reputation dimensions stay unknown. The run retained six closed jobs without reviews and two guard reputation drift warnings.
- Diagnostics and Master read `name` and `enabled` from the registry and derive health from snapshots for `quickguard.uk`. Master uses the latest snapshot per monitored agent from the latest 500 site rows and a 15-minute freshness threshold. It warns on the empty registry separately from failed reads, missing or stale telemetry. It saw 13 agents with fresh telemetry, three GREEN, eight AMBER and two RED. At 13:42 UTC, Client Selection and Job Funding were RED. Their 13:57 UTC follow-up and remaining finance decisions are recorded above. Master also retained the warning about five failed email queue items.
- SIA uses `assigned_at` for assignment age and validates the response before counting rows. The four real assignments replace the earlier invalid count of one error item. No critical SIA finding appeared after the corrected read. Five incidents, 11 warnings and one historical expiry finding remain for the authorised reviewer, as described below.
- Read-back confirmed that the three overdue assignments are still confirmed and funded without attendance or completion evidence, the client dispute is still open, and the reconciled £80 reversal is still failed. The booking disposition, chargeback review, and SIA decisions remain open.

### Query repair rollback

Private API exports are on HAL in `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/query-repair/backup-20261122T133646Z/`. Use the appropriate `<workflow-id>.json` file.

| Workflow ID | Active version before query repair |
| --- | --- |
| `8M4HAkmigFxAH7ck` | `d146ad96-014a-4fcc-b053-8e1e9ce366bf` |
| `Mz39wYS4Fewhyvs0` | `5c690468-7871-4798-959d-7b54d926296a` |
| `hd2rIh2umh83tydj` | `57a9f0d7-e06d-4bda-9c81-254c173d07b8` |
| `adtv1EnDe1eblBED` | `6850092d-3912-4bab-94cf-77965626edb9` |

Use this SIA backup to undo only the query repair while retaining the earlier eligibility-monitoring change. The parent `query-repair/` directory contains backup checksums in `manifest.json`, per-workflow diffs, `focused.log` and `verification.json`. To roll back, check for intervening changes and use the supported n8n API or UI to restore the affected definition to the same ID. Verify its active definition and scheduled snapshot. Keep private exports outside Git and leave the running SQLite database intact.

## Earlier HAL deployment and verification, 02:07 UTC

The three repairs are live on HAL. Each workflow retained its ID, five-minute schedule, active state, credential references, and downstream reporting contract. The workflow updates changed monitoring only. Payment, dispute, attendance, and guard eligibility records were preserved.

| Workflow ID | Published version | Published UTC, 22 Nov | Scheduled execution ID | Snapshot ID | Snapshot UTC, 22 Nov |
| --- | --- | --- | --- | --- | --- |
| `TG4JyKI67D1Fro4b` | `67b2b64a-2be9-411c-b200-5d300cc4bd0d` | 02:03:23.405 | `376619` | `e2393811-4f8f-4adf-ac56-0e8a8688fe39` | 02:07:04.408 |
| `6LMw86OKAGurTJv3` | `bbdae81f-3f61-46df-a8f7-ec44cecf28f0` | 02:03:23.599 | `376611` | `abb426d9-7c4f-4456-801d-b7a07b00a96d` | 02:07:02.774 |
| `adtv1EnDe1eblBED` | `6850092d-3912-4bab-94cf-77965626edb9` | 02:01:18.348 | `376621` | `5d1159b8-c2a3-4c34-bcbc-8fe02f3eb503` | 02:07:04.172 |

Each execution succeeded in scheduled trigger mode, ran the listed version, and wrote the matching row in `app.agent_state_snapshots`. All three snapshots were AMBER with zero critical incidents. A later execution-data review found that the 02:07 SIA assignment request returned HTTP 400 and its one error item was counted as an assignment. The query repair and corrected counts are recorded above.

- **Payout.** The monitor now reads paginated completion requests and requires approved evidence for the same job, guard and client, timestamped before payout initiation. The read stops the workflow on HTTP errors. The scheduled run read six completion requests and cleared the three false approval alerts. It reported one warning for the reconciled £80 reversal, which remains failed. Missing payment evidence, open disputes and duplicate transfer IDs still raise critical findings in the reasoning tests.
- **Job monitoring.** The monitor reads dispute records and distinguishes an open client dispute, a Stripe chargeback hold, and a dispute flag needing investigation. A held job stays visible while the monitor skips staffing, funding, and attendance expectations that assume the job can proceed. It retains recorded no-shows and operational issues. The run observed six jobs and 17 assignments, with three holds, six incidents and six warnings. Both chargeback holds and the open client dispute remain in place.
- **SIA.** The monitor counts account activity, pending or manual-review onboarding, and the marketplace account checks separately. Marketplace account checks require an active account and recorded admin approval with an approved or verified status, and exclude expired SIA dates. Job-specific licence, entitlement, and selection requirements still apply. The heartbeat observed 20 guards, including 13 active accounts, 10 pending or manual-review profiles, and three meeting the marketplace account checks. It read zero separate SIA verification rows in that run.

All 15 isolated workflow tests passed. All 973 repository unit tests passed on Node 22, the CI runtime. The first scheduled pass exposed a malformed URL expression in the new payout and dispute reads. The revised versions include expression coverage, and the subsequent scheduled executions confirmed both reads and snapshot writes. The isolated tests did not invoke downstream payment or messaging actions.

### Rollback

Private originals are on HAL under `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/hal-backup/20261122T015322Z/`. Use the `<workflow-id>-api.json` export for the corresponding workflow.

| Rollback export | Original active version |
| --- | --- |
| `TG4JyKI67D1Fro4b-api.json` | `c7240a62-9a55-49a0-bb0e-ed1dbb1d375a` |
| `6LMw86OKAGurTJv3-api.json` | `878c6fd4-9e6a-4c35-b086-f4471b46388a` |
| `adtv1EnDe1eblBED-api.json` | `a6171848-e163-4462-99c8-6801da65fe96` |

The parent chat workspace's `work/` directory contains `deployment-manifest.json` with backup checksums, the three `<workflow-id>-repair.diff` files, `heartbeat-verification.json`, `hal-tests.log`, and `repo-unit-node22.log`. These files and workflow exports are stored outside Git.

If rollback is needed, compare the current active version to this handoff and check for intervening changes. Restore the affected workflow definition to the same workflow ID through the supported n8n API or UI. Read back its active version and verify a new scheduled snapshot. Keep the running SQLite database intact.

### Decisions still open

- **Three funded assignments.** Assignments `8b7ecedb-2829-4954-a627-025f2d13533a`, `6f837b43-416f-4a41-beb5-f89b5d97da11`, and `0b9325dc-e26c-4c60-82a8-47161a2d7110` remain confirmed and funded. Their scheduled dates passed on 21 October, and the live records show completed funding transactions with no check-in, check-out, or completion evidence. Operations and finance need to decide the disposition of each booking. Any authorised cancellation or refund must follow the existing contract. Attendance and approval timestamps require actual evidence.
- **SIA review.** The verified snapshot contains five incidents, 11 warnings, and one historical expiry finding. Review the three approved or verified profiles missing a recorded admin reviewer, the missing licence number, and the SIA data mismatch. Reconcile the administrative override, six missing front-document references, the missing valid expiry date, and three missing verification timestamps against the underlying evidence. An authorised reviewer must decide any profile or eligibility action. The monitor changed no guard records.

## Original repair instructions

The following sections record the pre-deployment findings, scope and repair instructions.

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
