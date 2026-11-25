# Admin maintenance snapshot query repair — 25 November 2026

The published System Status page returned a maintenance statement timeout and could not load cleanup activity. Database logs recorded timeouts at 12:44:26 and 12:45:22 UTC.

The existing reporting RPC scanned cron.job_run_details twice per configured job. Production had 14 configured jobs and approximately 142,000 history rows, with only the runid primary-key index. Its warm-cache full execution took 1,439 ms and touched 512,318 shared buffers.

The migration reads the job history once, calculates seven-day counts per job and joins each job's latest run. The signature, JSON shape, latest-run tie-breaker, null ordering, failure-message redaction, seven-day boundary, cleanup evidence, pagination, SECURITY INVOKER and existing service-only grants remain intact. No cleanup is executed.

## Verification

- A read-only single-snapshot comparison against production returned byte-equivalent JSONB for all 14 jobs and 444 cleanup records.
- The full candidate took 386 ms as postgres and 459 ms as service_role. The latter used a read-only transaction. These are sampled database timings, not an endpoint latency guarantee.
- scripts/ops/test-admin-maintenance-history.sql passed in Test Batabase. All synthetic schemas, tables, functions and records were rolled back.
- Cases include empty data, seven pagination/bounds combinations, no runs, tied starts, null starts, old and future runs, the strict seven-day boundary, orphan history, private-message redaction and fresh/stale/failed cleanup evidence.
- Two initial fixture submissions failed SQL parsing before execution; the corrected complete script passed.
- No frontend or Edge Function change is needed.

## Production acceptance

Applied as provider migration 20261125125635_optimize_admin_maintenance_history. The repository filename matches that migration identity. Source readback confirmed the candidate body, unchanged postgres ownership, STABLE volatility, empty search_path, SECURITY INVOKER, service_role EXECUTE and denial to anon/authenticated.

A fresh authenticated published-page retest completed at 12:57:52 UTC: System Status shows Core Services Healthy, all 14 scheduled jobs, the six cleanup target inventories and recent completed cleanup activity. The maintenance timeout/schema warning and cleanup-loading error are absent. Historical failed payout count remains one and has not been hidden. No cleanup was run. No frontend publication or Edge deployment was needed.

PR merge and wider admin/media upload-publication acceptance remain separate. A separately requested cleanup of old cron history is pending its own explicit confirmation and is not part of this migration.
