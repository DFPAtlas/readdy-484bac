# QuickGuard HAL worker repair handoff — 22 November 2026

Continue the authorised QuickGuard admin repairs from this repository. Production project: `vnywjfpkepjgclkbcmsj`. The separate approved recovery target is `dnbvybmulsppfjntbsxz` in Frankfurt; its private `qg_recovery_20261122` schema is a core-data drill, not a live application database.

## Job Intake evidence for test draft `874f8b49`

The 19:12 UTC Job Intake snapshot on 22 November reported `SIA_TYPE_NOT_SPECIFIED` for job `874f8b49-2641-4238-b2a0-2b822bc362d4`. The booking has `sia_licence_required=true`, but its licence-type fields are blank. The `event-security` category and booking description do not support a specific SIA licence type.

The job is still a draft. Its title identifies it as a test draft and the description says no booking or work is requested. QuickGuard showed no applications, assignments, or guard notifications.

**Open decision for the booking owner.** Confirm whether to retire the internal audit draft. If the owner intends to publish it as a real booking, confirm the duties and required licence type before publishing. The review left the booking and workflow in place.

## Dispute & Refund monitor repair, 19:02 UTC

Workflow `2wtdCiZ55DLQrfQg` now reads Stripe chargeback audit records. It matches each event to the booking and a completed payment transaction, checks the charge reference when recorded on the transaction, and uses the latest matching event per Stripe dispute. The audit query is read-only. An unavailable or malformed audit response raises its own warning. Unexplained dispute flags still raise a P1 finding, and existing refund and payout safeguards remain in place.

| Booking | Verified scheduled finding |
| --- | --- |
| `726f86b4-e8a5-4a3e-907e-3a2d1facbd25` | GBP 88 Stripe sandbox chargeback lost. Audit `2471c613-5f25-4c2f-9c0e-4509bbedb483`. Hold remains pending finance closeout. |
| `626f86b4-e8a5-4a3e-907e-3a2d1facbd25` | GBP 88 Stripe sandbox chargeback won. Audit `d80bc06c-922b-4936-92a4-d9136ec2c6dc`. Hold remains pending finance closeout. |
| `926f86b4-e8a5-4a3e-907e-3a2d1facbd25` | Explicit superseded sandbox payout hold. The GBP 88 capture remains recorded, and the assignment still shows `payout_pending` without a payout release or transfer reference. Operations and finance still need to decide how to retire the fixture and whether to refund or retain the sandbox capture. |
| `826f86b4-e8a5-4a3e-907e-3a2d1facbd25` | Separate open internal client dispute `9ed87b9e-2846-4e84-8155-7a9a78ddada1`. Preserve it for the existing dispute process. |

Version `5795fd94-cbfd-4b20-8702-8fac3ad0be73` was published at 18:59:25.999 UTC on 22 November. All eight focused tests passed on Node 22. They covered won and lost outcomes, mismatched and unavailable audit evidence, the documented hold, unexplained flags, internal disputes, refund limits, and preserved workflow configuration.

Scheduled run `379667` succeeded and wrote **AMBER** snapshot `7179f178-2e0f-4fe7-8025-b65fde429160` at 19:02:03.052 UTC. The audit read returned HTTP 200 and four rows. The snapshot recorded two chargeback warnings, one superseded hold warning, one open internal dispute warning, and zero critical incidents. The three generic missing-dispute alerts cleared. Read-back confirmed all four dispute flags and the superseded assignment's unreleased payout state. No holds or payment records were changed.

The private rollback export is on HAL at `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/dispute-reporting/backup-20261122T185854Z/2wtdCiZ55DLQrfQg.json`. Its original active version is `9a26039c-d54a-44ce-9343-b48253e00c00`. The parent directory contains the checksum manifest, diff, focused test log, and heartbeat evidence. Check for intervening changes before restoring the same workflow ID through the supported n8n interface.

## Email reporting and event deduplication, 18:17 UTC

The email worker and Master now report current failures separately from historical test failures. A failed `email_system_e2e_test` row marked `metadata.test=true` is historical once at least 30 days have elapsed since its last recorded update. Both snapshots retain the historical and total failure counts. The worker also retains an audit finding per historical failure, including the queue ID and stored error. Recent test failures and other failed messages remain actionable. A failed queue read produces an explicit finding with unknown counts.

The five original 2 October test rows remain failed and unsent in QuickGuard. Their stored Resend responses show sender-domain verification rejections before acceptance. The connected Resend account currently lists `quickguard.uk` as verified with sending enabled, and later QuickGuard test messages were delivered. The original provider responses are preserved in the queue.

The email worker now compares the event identity, recipient, and email type. Cancellation messages use `cancellation_id` when present. Other messages can use an explicit event ID or idempotency key. Rows without an event identity are excluded from duplicate matching. The two cancellation notices with identical subjects and recipients have different cancellation IDs, and the false warning cleared. Matching rows for the same event still raise a warning. Dispatch logic, schedules, credentials, and workflow wiring were preserved.

| Workflow | Published version | Published UTC, 22 Nov | Scheduled run | Snapshot ID and time UTC | Verified result |
| --- | --- | --- | --- | --- | --- |
| Email & Notification `Dgd8rf3KUSoxmVfi` | `21b06d77-9378-4251-8ebc-a3de67992e69` | 18:16:34.615 | `379534` | `2dbe1fe1-edc7-4205-9f56-7bc4b7b90e3f` at 18:17:03.225 | GREEN, 60 rows, 55 sent, zero current failures, five historical failures, zero duplicate warnings |
| QuickGuard Master `hd2rIh2umh83tydj` | `4c0c9575-751c-42a3-9185-f048acfd4824` | 18:16:34.776 | `379543` | `45606afa-3e84-4f5c-a08f-73bbb44a745e` at 18:17:04.621 | AMBER for other findings, zero current email failures and five historical failures |

All seven focused tests passed on Node 22. Both scheduled queue reads returned HTTP 200 and matched the persisted snapshots. No message was replayed, and the Resend send node did not run in the verified execution.

Private exports are on HAL under `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/email-reporting/backup-20261122T181607Z/`, named by workflow ID. The original active versions were `adf0fed7-7dca-400c-8fd5-5dde23320fad` for Email & Notification and `c912df68-838d-46ec-b2d7-468052837911` for Master. The parent directory contains the backup checksums, diffs, focused test log, and heartbeat verification. Check for intervening changes before restoring an export to the same workflow ID through the supported n8n interface.

## Review & Reputation repair, 16:32 UTC

Workflow `8M4HAkmigFxAH7ck` now calculates public ratings and review counts from `status='published'` reviews only. The public average is rounded to one decimal place and defaults to zero when there are no published reviews. Hidden reviews still count as submitted for booking and review integrity checks. Review `21633a4d-6d27-41d4-8bb6-a23d1b3e0864` remains hidden, and the guard's stored public rating and count are both zero.

Closed, unassigned, unfunded adverts no longer require reviews. The scheduled run covered all five retired adverts and raised no missing-review warnings for them. Warnings for paid or assigned closed jobs without reviews, genuine reputation drift, and review integrity issues remain in place. Failed or malformed reads produce warnings and unknown counts for the affected inputs.

Version `d0a7ceb9-03a7-4f34-bb48-83fbdf16b1b8` was published at 16:30:28.039 UTC on 22 November. All nine focused tests passed on Node 22. They covered hidden-only and mixed reviews, genuine rating and count drift, rounding, retired adverts, failed or malformed reads, hidden-review integrity checks, and workflow preservation.

Scheduled run `379217` succeeded and wrote **GREEN** snapshot `77a5a0e9-8d35-4f86-8efd-7ea039f406de` at 16:32:02.874 UTC. All four input reads returned HTTP 200 and matched the snapshot counts. The run observed 10 jobs, 17 assignments, 22 guards, one hidden review, and zero published reviews. The two false drift warnings cleared. The snapshot recorded zero incidents and zero warnings.

The private rollback export is on HAL at `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/reputation-repair/backup-20261122T162958Z/8M4HAkmigFxAH7ck.json`. The original active version is `968f0d6c-36da-48ff-8a01-81c4a9d796f3`. The parent work directory contains the checksum manifest, deployment diff, focused test log, and heartbeat evidence. Credentials, schedules, workflow wiring, reviews, and guard ratings were preserved.

## Subscription worker wording and Basic renewal trace, 15:12 UTC

HAL subscription workflow `pGoacDSUO4i4dNMN` now describes the Elite incident as active paid-tier access without linked Stripe billing evidence. The original incident code `PAID_SUBSCRIPTION_MISSING_STRIPE_ID`, P1 severity, and trigger condition were preserved. The Basic stale-sync alert was unchanged. The patch changed one string in Subscription Reasoning and preserved the workflow ID, five-minute schedule, active state, credentials, queries, and downstream contracts.

The new version `68e8eb33-b22f-4089-8f0d-17583f44aa5d` was published at 15:07:16.352 UTC on 22 November. All four focused tests passed on Node 22. Scheduled run `378989` succeeded and wrote AMBER snapshot `2c42ddba-396f-47e6-91c5-c01b07194f47` at 15:12:04.623 UTC. The snapshot contains the revised Elite wording and both P1 findings, with 19 warnings. Billing, entitlements, and webhook destinations were left in place.

### Basic renewal and customer mapping

- QuickGuard subscription `58ea2b87-c8e7-484b-a97e-e8d0eccfdaae` and its entitlement still show a period end of 5 November 2026, 18:30:50 UTC. The original paid GBP 10 Checkout Session links sandbox subscription [`sub_1UNGf0IMkpwfAEDTfSohHVse`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/subscriptions/sub_1UNGf0IMkpwfAEDTfSohHVse) and sandbox customer `cus_VO2jzA0T87Gutg` to the same QuickGuard user.
- Stripe sandbox shows a paid GBP 10 renewal invoice `in_1UYVRqIMkpwfAEDTE5wg03Vk` and a subscription item period end of 5 December 2026, 18:30:50 UTC. Stripe emitted `invoice.payment_succeeded` event `evt_1UYWOXIMkpwfAEDT1OgjhUxa` at 19:32:21 UTC on 5 November. Stripe listed one pending webhook delivery when inspected. The production event ledger had no matching processing receipt and the renewal invoice was absent from production subscription payments.
- The current sandbox endpoint configuration routes invoice and subscription events to projects `alfwwggavmyerjyqumuo` and `dnbvybmulsppfjntbsxz`. The production project `vnywjfpkepjgclkbcmsj` has a sandbox bank-payout endpoint, which does not subscribe to renewal invoices. This supports a routing gap. The endpoint list and pending count do not establish the historical delivery outcome for each destination.
- The guard profile points to `cus_VcfannyExX18cO`, a live Stripe customer tagged with the same QuickGuard user ID. Stripe returned zero subscriptions for that live customer. The sandbox and live IDs refer to different Stripe environments. An authorised billing owner needs to decide how this sandbox UAT subscription and its entitlement should be represented in QuickGuard before any routing, mapping, or reconciliation change.

Elite subscription `676905df-1efb-4c27-ad17-453cb82d3581` still grants an active paid tier without a linked billing reference. An authorised reviewer still needs to establish whether this is an intentional non-billed grant or an incorrect entitlement.

### Subscription worker rollback

The private API export is on HAL at `~/Documents/Codex/2026-11-22/continue-quickguard-admin-repairs-from-dfpatlas/work/subscription-wording/backup-20261122T150657Z/pGoacDSUO4i4dNMN.json`. Its original active version is `d9d98d81-0056-4ef1-9ae3-fada9693ca94`. The parent work directory contains the checksum manifest, diff, focused test log, and verified heartbeat evidence. Check for intervening changes before restoring the workflow to the same ID through the supported n8n API or UI, then verify the next scheduled snapshot.

## Client Selection and Job Funding repair, 13:57 UTC

The 13:52 UTC RED snapshots had two Client Selection critical findings and eight Job Funding critical findings, all on the same two October chargeback fixtures. Fresh production read-back confirmed that job `726f86b4-e8a5-4a3e-907e-3a2d1facbd25` had a lost chargeback and job `626f86b4-e8a5-4a3e-907e-3a2d1facbd25` had a won chargeback. Both remain confirmed, funded and dispute-flagged, with no assignment or application. Each has a completed GBP 88 original payment, an agreed amount of GBP 80 and a recorded client charge total of zero. The audit requires finance review for both outcomes.

Both monitors now classify recorded dispute holds before applying active-booking selection and assignment rules. The hold findings retain the outcome and record counts. Funding emits one missing-assignment finding per undisputed active job and continues to check a held booking for genuine payment issues. It uses a positive recorded client charge total and comparable currency and amount for reconciliation. A missing client total is a warning requiring evidence. A mismatch against a recorded total, currency mismatch, duplicate payment, and a funded job without completed payment evidence still raise findings.

| Workflow ID | Published version | Published UTC, 22 Nov | Scheduled run | Snapshot ID | Snapshot UTC, 22 Nov | Verified counts |
| --- | --- | --- | --- | --- | --- | --- |
| Client Selection `HkKkrBniZ8R5g3q3` | `29b37736-816c-4ef7-8870-8d2a9469a418` | 13:54:39.040 | `378754` | `1d78d224-c031-45e6-bd99-56a957479ce1` | 13:57:03.630 | AMBER, 5 jobs, 13 applications, 17 assignments, 22 guards, 2 hold warnings, 0 critical |
| Job Funding `aBj0Oc0NBWlzYCuh` | `673079dc-03cd-42ff-8768-0ec7a6b76a9c` | 13:54:39.175 | `378759` | `adac063b-c927-4c58-acd5-0ccbb54a63b7` | 13:57:04.143 | AMBER, 5 jobs, 12 selected applications, 17 assignments, 19 transactions, 2 hold warnings, 2 reconciliation warnings, 0 critical |

Nine focused tests passed on Node 22. Fixtures covered won and lost holds, real undisputed selection gaps, missing and duplicate payment evidence, genuine amount and currency mismatches, failed job reads, and preservation of workflow wiring and schedules. Both scheduled job reads returned HTTP 200. Other reader outputs matched the persisted counts. The runs saved fresh rows in `app.agent_state_snapshots`.

### Stripe sandbox evidence

The QuickGuard sandbox PaymentIntents requested GBP 88 and the linked charges captured GBP 88 for each booking. Both PaymentIntents are tagged `quickguard_dispute_uat` and carry the corresponding job ID.

| Booking | PaymentIntent | Charge | Requested | Captured |
| --- | --- | --- | --- | --- |
| `726f86b4-e8a5-4a3e-907e-3a2d1facbd25` (chargeback lost) | [`pi_3UMu9yIMkpwfAEDT1WTjA19K`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/payments/pi_3UMu9yIMkpwfAEDT1WTjA19K) | `ch_3UMu9yIMkpwfAEDT1AGkNnmW` | GBP 88 | GBP 88 |
| `626f86b4-e8a5-4a3e-907e-3a2d1facbd25` (chargeback won) | [`pi_3UMu3yIMkpwfAEDT0ATDH5Wl`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/payments/pi_3UMu3yIMkpwfAEDT0ATDH5Wl) | `ch_3UMu3yIMkpwfAEDT0d59AoSa` | GBP 88 | GBP 88 |

Stripe establishes the intended sandbox charge on both payments. QuickGuard records an agreed amount of GBP 80 and a client charge total of zero on each booking. Neither PaymentIntent had an associated Checkout Session or a fee breakdown, so what the GBP 8 difference represents remains unknown. Operations and finance still need to decide the disposition of both bookings. The evidence review left the dispute holds and original payment records in place.

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

- **Three overdue funded assignments.** Operations and finance decisions remain open. The booking, attendance and Stripe evidence is recorded below.
- **SIA review.** The verified snapshot contains five incidents, 11 warnings, and one historical expiry finding. Review the three approved or verified profiles missing a recorded admin reviewer, the missing licence number, and the SIA data mismatch. Reconcile the administrative override, six missing front-document references, the missing valid expiry date, and three missing verification timestamps against the underlying evidence. An authorised reviewer must decide any profile or eligibility action. The monitor changed no guard records.

### Evidence for the three overdue funded assignments

All three Pub Door Supervisor sandbox UAT bookings were scheduled for 21 October 2026, 18:00 to 23:00 as recorded on the booking. Each booking and assignment still shows `confirmed` and `funded`. QuickGuard records a client charge total of GBP 86.25 and one completed funding transaction per booking on 7 October. The matching Stripe sandbox PaymentIntents each requested GBP 86.25 and the linked charges each captured GBP 86.25, for GBP 258.75 in total. Stripe showed zero refunded and no dispute on any of the three charges.

| Assignment ID | Booking ID | QuickGuard funding transaction ID | Stripe sandbox payment |
| --- | --- | --- | --- |
| `8b7ecedb-2829-4954-a627-025f2d13533a` | `b7313021-04a0-4774-a9f0-51dbae4e03b7` | `5469a8ab-18b6-4c06-841c-885b99e9aeca` | [`pi_3UNuN9IMkpwfAEDT1eBNIrtM`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/payments/pi_3UNuN9IMkpwfAEDT1eBNIrtM) |
| `6f837b43-416f-4a41-beb5-f89b5d97da11` | `840e01b4-8676-4e80-bd5e-1b8bf75d28a8` | `1f41467d-e0d1-4adc-8da1-a404cf024b1e` | [`pi_3UNuCUIMkpwfAEDT0SrNCK8j`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/payments/pi_3UNuCUIMkpwfAEDT0SrNCK8j) |
| `0b9325dc-e26c-4c60-82a8-47161a2d7110` | `ce737c6c-5297-4494-9503-252dfac9774a` | `4787eb03-0b08-4ec2-bcda-5dcf89908c6c` | [`pi_3UNxIkIMkpwfAEDT0mJORoje`](https://dashboard.stripe.com/acct_1SYmuoIMkpwfAEDT/test/payments/pi_3UNxIkIMkpwfAEDT0mJORoje) |

Attendance remains unverified. All three assignments show `awaiting_confirmation`. The review found no guard confirmation, check-in, check-out, completion timestamp, completion request, or attendance audit event. QuickGuard shows no payout release or guard payout record.

- **Operations decision.** Determine the disposition of each expired fixture and whether evidence outside QuickGuard establishes what happened. Record the reason for the disposition and preserve the booking history. Any completion or no-show classification requires supporting evidence.
- **Finance decision.** Determine whether closeout should include a sandbox refund through the existing cancellation and refund process or whether to retain the captures as UAT evidence with a documented disposition.

The evidence review was read-only.

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
