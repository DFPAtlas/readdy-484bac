# Free core guard access — phase 1

Prepared 25 November 2026. This is an isolated sandbox change and draft PR, not the 1 December launch sign-off.

## Result

New guards without an entitlement, free guards and current/former paid guards can apply to every legacy job tier without a monthly application allowance. Active-account, recorded administrator approval, SIA/licence, ownership, job state/date, duplicate and invitation checks remain authoritative. Monthly application counts are informational and scoped to the signed-in guard.

Paid profile boost/priority flags no longer affect discovery or applicant ranking. The public placement RPC retains its existing eligibility, test-account visibility and 200-ID batch filters, returning neutral flags. Browser sorting ignores even stale paid flags, using rating and ID as the deterministic default order. Explicit client filters/sort choices remain intact.

Both job alert implementations no longer join or query guard billing entitlements. Existing distance, venue, licence and preference checks remain; recorded approval is required. Guard application screens, dashboard banners, tracker and usage widgets no longer sell additional applications. Older-server limit/tier errors remain explicit, retryable failures rather than upgrade redirects. Client posting limits and responses are unchanged.

No subscription, Stripe reference, fee, reward, entitlement or usage history is rewritten. Optional paid-service screens and commercial material still need the separate transition below.

## Baseline and sandbox deployment

- Repository: `DFPAtlas/readdy-484bac`; base `0e6da6ac2b1957db46ae3bc37c2b692015622da8` (merged PR 276).
- Branch: `feat/free-guard-access-20261125`.
- Existing sandbox: `qg-e2e-sandbox`, project `alfwwggavmyerjyqumuo`.
- Local migration: `20261125173242_free_guard_application_access.sql`; applied only to that sandbox.
- Sandbox Edge handlers: `apply-to-job` version 48; `notify-matching-guards` version 55. Both retain `verify_jwt=true`. Anonymous HTTP requests return 401 (`UNAUTHORIZED_NO_AUTH_HEADER`). Their preceding deployed source matched the base repository apart from final newlines.
- Cron remains disabled and token checkout remains off. No real email/push delivery or payment was exercised.
- Production `vnywjfpkepjgclkbcmsj` was inspected read-only. Its four original function fingerprints match the baseline below; no production deployment or billing operation was performed.

Original function MD5 fingerprints:

| Function | Original fingerprint |
| --- | --- |
| `public.notify_matching_guards_on_job_post` | `793d573cac8dcbf83f501aa54a84b6f9` |
| `app.submit_job_application` | `de8d48df3d9fe2efd0652d5e31f0a143` |
| `app.get_my_feature_usage` | `580296d37b7810209b6dc2244a13e560` |
| `app.get_guard_placement` | `0ddececc10936b7a5f4493d087b5b944` |

The trusted application RPC remains service-only. Usage remains authenticated, caller-scoped and read-only. Public placement returns no private profile or billing fields. Existing security-definer ownership and fixed search paths are preserved.

## Verification

- Before changes: 25 application-expiry, placement and invitation tests passed.
- Full regression run with two workers: 1,274 tests passed, zero failed/skipped. An initial unrestricted parallel run terminated multiple test processes and the concurrent linter; it was not counted as a pass. `test:unit` now consistently uses two workers while running every test.
- Final focused dashboard/usage tests passed after the last dashboard changes. New PostgreSQL tests cover absent/free/paid/cancelled/past-due entitlements, applications beyond the old cap, Elite jobs, unchanged billing/history and client quota response, ownership/ACL/session isolation, recorded approval, inactive accounts, SIA/licence failures, closed/deleted/expired jobs, atomic failure, duplicates/invitation replay, neutral public placement and native alert-trigger matching. UI/handler fixtures exercise the actual application component and shared widgets, stale flags, postcode filtering and the real matching handler without provider delivery.
- Repository TypeScript, admin/financial TypeScript and Next production build passed. Final lint passed with zero errors and 12 warnings in pre-existing unrelated files. Build validation explicitly used a loopback placeholder Supabase URL rather than production.
- Native sandbox `scripts/uat/free-guard-access-smoke.sql`: six checks passed — owned unlimited usage with no entitlement; neutral placement; browser EXECUTE denial; foreign actor denial; trusted application to an Elite job without entitlement; duplicate rejection with exactly one application. The synthetic job temporarily restores its closed soft-delete/date flags inside the rollback-only transaction.
- Post-smoke aggregate row digests matched the original guards, jobs, subscriptions, entitlements, applications and email queue. No fixture data persisted.
- Local Chromium could not launch because the execution environment disallows its process-singleton socket. Desktop (1440px) and mobile (390px) built-page smoke is therefore not claimed as locally passed. `scripts/uat/free-guard-browser-smoke.cjs` and the PR Build Check run it with synthetic API responses, covering explicit denial/retry, success after fifty applications, no upgrade redirect and no page runtime errors. CI result must be reviewed before merge. This is separate from native Supabase acceptance and is not an authenticated real-account browser/Edge/payment test.

Sandbox Security Advisor still reports two security-definer view errors and existing broad RPC-execution warnings; the migration adds no new functions or browser execution grants. Health Advisor has no findings. Existing performance findings (unindexed foreign keys, RLS evaluation/policy duplication and duplicate indexes) are outside this change. These are recorded rather than presented as a clean launch audit. References: [view review](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [anonymous function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated function execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Rollback

`scripts/uat/free-guard-access-rollback.sql` restores the four captured original function definitions. Restore the base frontend and base `apply-to-job`/`notify-matching-guards` source as part of the same rollback; keep the existing JWT setting. The SQL changes no billing or historical data, so there is no financial data backfill to undo. The restore script is prepared from the actual sandbox baseline; a complete restore/reapply rehearsal remains a release gate.

## Gates before the 1 December launch

1. Review this draft PR and its exact-head CI/browser results. Complete a controlled authenticated sandbox browser/Edge journey and restore/reapply rehearsal; do not reopen the retained closed fixtures merely to make a test pass.
2. Complete the commercial/legal transition together: update guard registration, pricing, upgrade, marketing and terms so work access/placement is never sold; decide the handling/notice/refund path for existing paid customers while retaining financial history. Existing subscriptions are not automatically cancelled by this phase.
3. Implement and validate client subscription service tiers, fee absorption and authoritative invoice/payment snapshots. Confirm the final model and wording with appropriate UK employment/payment/privacy advice. No legal compliance sign-off is implied here.
4. Implement the guest Book a Guard flow, genuine availability counts, account creation before booking, secure draft recovery, and consent-based abandoned-booking lead handling/retention.
5. Finish the integrated sandbox smoke across guard, guest, client, admin, consent, payments, refunds and failure/retry paths; record evidence and remaining findings. Then separately approve the reviewed production rollout and final live smoke.
