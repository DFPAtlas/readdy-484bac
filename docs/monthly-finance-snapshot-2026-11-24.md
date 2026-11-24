# Monthly finance snapshot repair — 24 November 2026

The scheduler's historical invalid JSON failure was already repaired by migration `20261121233653`. Its body is now `{}`; schedule, enabled state and credentials are unchanged. A failed 1 November execution is historical evidence, not a new successful run. This repair does not delete or relabel it.

The remaining function defects were independently confirmed:

- Authenticated non-POST requests could create the previous month's report.
- MRR read `billing_interval` without selecting that field, so intended annual/weekly/daily normalization never received its source value.
- Several unpaged source lists could stop at the API row limit.
- No monthly unique index protected concurrent inserts; retries could create duplicate history.
- Missing source pages or an unconfirmed insert must not be returned as a confirmed report.

The function now accepts POST only (OPTIONS remains a no-op), pages each list in ID order, selects the existing billing interval, and returns a verified saved month/UUID. The existing payment cohort, GBP/pence conversions, fee/cost/refund/payout formulas and previous UTC month selection are preserved. Exact service credentials or a verified active finance administrator with MFA remain required. JWT verification remains enabled.

The migration adds one unique index on `app.finance_snapshots(snapshot_month)`. It does not rewrite or delete history. Existing duplicates or a conflicting index definition cause migration failure. The function handles an insert uniqueness conflict by reading the saved report for the same month, rather than overwriting it or manufacturing a successful result.

## Validation

Ten focused behavioral/SQL cases cover method and authorization gates, loaded billing intervals, preserved financial calculations, 1,201-row datasets, retries, overlapping requests, failed source reads, unconfirmed receipts, true SQL uniqueness and duplicate/colliding-index preservation. All 1,216 full-suite regressions passed on the standalone rerun; repository/admin TypeScript and lint passed. The strict Deno check used the official pinned Supabase JS 2.49.1 declarations installed locally because this executor could not reach esm.sh. The deployment retains its original pinned import.

Production source readback, denied-request checks, index metadata and before/after data/access-policy hashes are recorded in the private admin acceptance report. No production snapshot is generated or backfilled as part of validation. The next natural monthly run still needs observation. This is a backend-only change; no Readdy frontend publication is required.
