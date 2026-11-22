# Profile-only guard job-match queue repair

A valid Auth account with an app.guards profile can lack a legacy app.users mirror. The job-match queue previously wrote the Auth identifier directly into email_queue.user_id, whose foreign key references app.users. This raised SQLSTATE 23503 and the enclosing job-post trigger logged the failure without creating an alert email.

The repair preserves the queue foreign key and RLS. Existing mirror users retain their queue association; profile-only users have a null optional association and retain the authoritative Auth and guard identifiers in server-owned metadata. No mirror accounts are created. Existing deduplication, terminal suppression, delivery state and retry semantics remain intact. Execution remains service-role only.

## Validation

- Reproduced the predecessor failure with the real legacy mirror foreign key in PGlite.
- The same profile-only account queues exactly once after migration.
- Verified trusted metadata overrides caller identifiers; no mirror is backfilled.
- Verified legacy association, pending/processing/queued/sending, sent, suppressed and failed retry behavior.
- Verified queue RLS/policies and FK remain intact, browser roles cannot execute, service_role can.
- Focused queue, invitation and registration regression suite: 49 passed.
- TypeScript check passed.
- Applied only to the isolated QuickGuard sandbox branch during acceptance.
- A fresh synthetic job insert produced exactly one pending job-match row for the synthetic guard; optional user_id was null and metadata retained the real Auth identity.
- The existing guard dashboard displayed that newly committed job and realtime toast without reload.
- Outbound email remains disabled in this sandbox: queue acceptance does not establish provider delivery.

## Deployment

Apply migration 20261122014216_profile_only_job_match_queue.sql after review/merge. It replaces one function and explicitly preserves service-only execution. No web UI publish or Edge function deployment is required for this database-only fix. There is no automatic replay of previously missed job alerts.

