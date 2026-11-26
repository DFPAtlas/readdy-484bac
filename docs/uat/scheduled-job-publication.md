# Scheduled job publication

## Confirmed gap

The job form saves a future publication as `draft` with `is_draft=true` and `publish_at`, but the reviewed main branch, hosted job functions and database schedules had no job publisher. `publish-scheduled-posts` handles social-media posts only. Read-only production inspection found no job-publication routine or cron and no scheduled job drafts. The earlier scheduled-confirmation repair acknowledges a draft; it does not publish it.

## Change

Migration `20261126164948_scheduled_job_publication.sql` adds the service-only, SECURITY INVOKER function `app.publish_due_scheduled_jobs(integer)`. It processes a bounded batch using database time and row locks with SKIP LOCKED. Only due, consistent, undeleted drafts belonging to active, unsuspended, completed client profiles can publish. Expired jobs and shifts that have already started in Europe/London are excluded. Unscheduled drafts and later booking/payment states remain untouched. Job-post usage is not charged again.

A narrowly conditioned UPDATE trigger reuses the existing neutral guard matching and authoritative queue dedupe keys. The matcher gains an argument-controlled strict mode: a queue failure rolls back that job's publication and all of its match queues, leaving the draft available for retry. Other jobs in the batch can continue; the result reports failed jobs and server logs contain the job ID/SQLSTATE. Existing direct-insert matching retains its non-blocking failure behaviour. Existing queue status reconciliation reports queued rather than delivered while mail is pending. This publisher queues guard emails; it does not claim inbox delivery or add push notifications.

The named cron runs every minute but installs **paused**. Migration replay preserves its activation state, and an unrelated command with the same name raises a conflict instead of being overwritten. There is no new Edge Function, browser authorization path, payment operation or secret. Existing RLS, matching filters, financial records and queue idempotency remain in place.

## Verification on 26 November 2026

- All 19 focused publisher, existing free-access and profile-only match-queue tests passed against PostgreSQL-compatible execution of the actual migration and existing queue/matcher functions. Cases cover early publication, public visibility, retries, invalid batches, role denial, inactive clients, ineligible/expired jobs, migration replay and preservation of direct-insert behaviour. Injecting a failure for a later matching guard proves both earlier queue inserts and the publication roll back together.
- Repository TypeScript and lint passed. Lint has 13 existing warnings and zero errors on this branch's public-page baseline. Current full-suite/build/browser results are recorded in the PR checks.
- The full run exposed four existing guest-wizard harness failures after the public-page redesign extracted `VenueCard`. The harness now renders the real stateless card, clicks its actual button and verifies its selected state. All seven guest storage/availability/consent tests pass with their original behavioural assertions retained; no application component was changed for this compatibility repair.
- Applied the exact migration only to sandbox `alfwwggavmyerjyqumuo`, native migration version `20261126170056`. Retrieved worker/matcher bodies match the migration exactly; the previous matcher body differs only in the strict failure branch. Native privileges deny anon/authenticated and allow service_role. The existing security-advisor baseline did not change.
- A temporary native background job held a synthetic row lock. At 17:05:25 GMT the competing worker returned zero publications while the lock was still visible. After release it published that job once, demonstrating real SKIP LOCKED behaviour rather than only a sequential retry.
- A separate timed draft was due at 17:07:08 GMT. Native one-minute cron runs at 17:06 and 17:07 succeeded without publishing it. It published at 17:08:00 GMT, the first tick after its due time. It changed to open/is_draft=false, with exactly one pending guard-match queue row and notification_status=queued. Replaying the worker returned zero publications and no duplicate queue.
- Anonymous native `get_public_jobs` HTTP checks returned 200: the timed draft was absent before publication and present afterward. The future and expired controls stayed absent. Their saved draft state remained unchanged.

The acceptance fixtures were explicitly synthetic, seeded through the service-side test setup. Only a marked synthetic guard was temporarily qualified, using a synthetic reviewer and isolated remote coordinates. This is not real SIA verification or admin-approval acceptance. No mail processor was enabled and no outgoing email was sent.

## Closeout

Removed all four owned test jobs and both pending test queue rows. Restored the guard's complete business-state hash (excluding its update timestamp), its inactive/manual-review state and the test client's inactive state. Retained jobs and email queue hashes exactly match baseline. The email-send log count is unchanged, fixture sessions are zero, original email settings are unchanged and all cron jobs are inactive again. The temporary locking job was removed; its run history remains as evidence. The publisher cron remains installed but paused.

Production was read-only during this work. Nothing was merged, deployed or activated there for this repair. This closes sandbox scheduled-publication and durable-queue acceptance, not bank settlement, browser inbox-click activation, legal review or complete launch sign-off.

## Production rollout and rollback

After exact-head review/CI and owner approval, verify the existing matcher still matches the prerequisite free-access migration, apply this migration and inspect its grants, definitions and paused cron. Review any pending production drafts and their expiry/start times before enabling the schedule. Activation must be explicit:

```sql
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='publish-scheduled-jobs'),
  active := true
);
```

Publication is due on the next minute tick, not guaranteed at an exact second. Inspect both cron execution and resulting job/queue state; a successful cron row alone is not delivery proof. Failed per-job results/logs require investigation. Queue delivery remains the existing email worker's responsibility.

Pause with the same call using `active := false`. Pausing stops future runs; it does not undo a published job, contract snapshot or delivered alert. Review any affected jobs and pending queues by exact IDs before remediation. Preserve financial/audit history and do not reset the database or broadly replay notifications. The captured predecessor matcher can be restored if needed; leave the paused function installed until a reviewed forward repair is available.
