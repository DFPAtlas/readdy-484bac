# QuickGuard — Supabase Migration Baseline & Schema Reconciliation (Prompt 4B)

STATUS: **ENTRY GATE BLOCKED — CREATED ONLY. NOTHING APPLIED TO PRODUCTION.**

This document is the reconciliation plan and drift report only. Per the safety
rules of Prompt 4B, no corrective SQL was applied to production because the
entry gate could not be fully satisfied (details below).

---

## 1. Entry gate results

| # | Gate | Result |
|---|------|--------|
| 1 | Read complete Prompt 4A report | **BLOCKED** — no Prompt 4A / drift map / live-inventory file exists in the repo, and it was not provided. |
| 2 | Confirm connected project reference | **PASS** — `.env` `NEXT_PUBLIC_SUPABASE_URL` = `https://vnywjfpkepjgclkbcmsj.supabase.co`, matches target `vnywjfpkepjgclkbcmsj`. |
| 3 | Record current Git commit | **BLOCKED** — no Git access in this environment. |
| 4 | Record live migration head | **PASS** — `20260813133857 / prevent_admin_users_self_privilege_escalation`. |
| 5 | Record repo migration filenames | **PASS** — see §3. |
| 6 | Confirm migration `030` exists in repo | **PASS** — exists. |
| 7 | Confirm `030` represented live | **PASS (negative)** — `030` is NOT in live history; its intended effects are only partially present via a different lineage. |
| 8 | Recheck Critical/High drift findings | **BLOCKED** — no Prompt 4A to recheck; independent drift analysis performed instead (§4). |
| 9 | Confirm backup / point-in-time recovery | **BLOCKED** — cannot confirm from this environment (no dashboard access). |
| 10 | Confirm no unreviewed destructive op | **PASS** — proposed work is `DROP POLICY IF EXISTS` only (non-destructive, idempotent). |

**Decision:** gates 1, 3, 8, 9 fail or cannot be confirmed, so Prompt 4B's own
rule applies: produce reconciliation files + validation plan only, apply nothing.

---

## 2. Connected project identity

- Supabase project reference: `vnywjfpkepjgclkbcmsj`
- URL: `https://vnywjfpkepjgclkbcmsj.supabase.co`
- Confirmed from `.env` (matches the target stated in the prompt).

## Migration heads

- **Live migration head:** `20260813133857` — `prevent_admin_users_self_privilege_escalation` (36 rows in `supabase_migrations.schema_migrations`).
- **Repository migration head (by filename):** `031_qg_reviews_transactions_rls_repair.sql`, plus two timestamped files (`20250228_...`, `20260606120000_...`). There is no single authoritative "head" in the repo because the repo files are hand-numbered, not CLI-generated.

---

## 3. Repository migration inventory

Numbered files (note gaps at 015 and 019):

```
001_core_schema
002_rls_policies
003_client_security_hardening
004_guard_documents
005_job_system_enhancements
006_job_posting_enhancements
007_recruitment_workflow_fixes
008_recruitment_workflow_audit_fixes
009_admin_dashboard_views
010_admin_rls_cancellations_refunds
011_client_plan_job_limits
012_fix_user_entitlements_feature_keys
013_guard_starter_plan_and_feature_alignment
014_fix_is_free_tier_generated_column
016_job_booking_flow_fixes
017_plan_fee_rules_seed
018_qg_launch_rewards
020_qg_launch_rewards_invites_phase_3
021_qg_launch_rewards_analytics_phase_4
022_qg_launch_rewards_exit_popup
023_qg_pre_account_token_tracking
024_qg_exit_popup_footer_test_icon
025_qg_launch_temporary_profiles
026_qg_launch_account_dashboard
027_qg_launch_rewards_rls_hardening
028_qg_popup_all_public_pages
029_guard_payout_security
030_qg_launch_rewards_critical_rls_repair
031_qg_reviews_transactions_rls_repair
```

Timestamped files:

```
20250228_admin_delete_and_payment_flow_readiness.sql   (8-digit prefix — NOT a valid CLI version format)
20260606120000_create_email_templates.sql             (valid 14-digit format)
```

---

## 4. Critical finding — migration history divergence

The repository's numbered migration chain and the live `schema_migrations`
history are on **two different tracks**. The live history (36 rows) uses
completely different names/timestamps than the repo files. The live DB was
built through a separate lineage:

- Early security migrations (`lock_down_security_definer_rpc_grants`, `close_pii_data_exposure_holes`, etc.)
- `move_app_objects_to_app_schema_and_lock_postgrest`
- `migration_001_core_schema` … `migration_004_fix_client_plan_price_ids` (a re-numbered import, different from repo `001`–`014`)
- n8n compatibility views
- `move_quickguard_leads_table_into_app_schema`
- `guard_payout_security_029` (the only entry that maps to a repo file, `029`)
- `prevent_admin_users_self_privilege_escalation` (live-only, newest)

Consequences:

- Repo `029` has a live counterpart; repo `030` and `031` have **no** live counterpart.
- The two timestamped repo files (`20250228_...`, `20260606120000_...`) do **not** appear in live history.
- The repo's `001`–`014` numbered files do **not** map 1:1 to live history names.

Object similarity is not proof of migration equivalence. This must be resolved
by capture/classification, never by blind `db push` or history rewriting.

---

## 5. Classified drift table (independent analysis — Prompt 4A unavailable)

### 5.1 Launch Rewards (repo `030` scope) — live vs intended

| Object | Repo `030` intent | Live state | Classification | Action |
|--------|-------------------|------------|----------------|--------|
| RLS on 16 qg tables + email_suppression_list | enable | all enabled | Equivalent | none |
| "Service role manages X" policies (16) | create | all present (`TO service_role`) | Equivalent | none |
| Admin ALL policies | "Active super admins manage X" | "Admin full access X" (already `authenticated` + `super_admin` + `is_active`) | Equivalent, name-only drift | none (secure as-is; rename is cosmetic) |
| "Public can read published campaigns" | drop (campaigns have no public read) | **PRESENT** (`TO public`, `status='published'`) | **Live-only, must fix (latent exposure)** | drop |
| "Public can read settings" | drop | present (`qual=false`, dead) | dead leftover | drop |
| "Anyone can read public stats" | drop | present (duplicate of "Public can read public stats") | duplicate | drop |
| "Anyone can read published updates" | drop | present (duplicate of "Public can read published updates") | duplicate | drop |
| "Anon can insert referrals" | drop | present (`with_check=false`, dead) | disabled leftover | drop |
| "Anon can insert launch profile" | drop | present (`with_check=false`, dead) | disabled leftover | drop |
| "Anon can insert pre-account tokens" | drop | present (`with_check=false`, dead) | disabled leftover | drop |
| "Users update own launch profile" | drop | present (`qual=false`, dead) | disabled leftover | drop |

Note: `qg_launch_campaigns` currently has **0 rows**, so the "published
campaigns" exposure has no actual data leaking today — but it is a latent
public-read policy and must be removed before any campaign row is created.

### 5.2 Reviews & Transactions (repo `031` scope) — partial

- `app.reviews`, `app.transactions`, `app.client_reviews`, `public.client_reviews` all have RLS enabled.
- `public.reviews`, `public.transactions`, `public.v_guard_payment_flow` are all `security_invoker=true` views — repo `031` intent achieved.
- `app.reviews` still carries old policies (`client_can_review`, `reviews_admin_all`, `reviews_admin_all_v2`, `reviews_client_insert`, `reviews_client_select`, `reviews_client_update`, `reviews_guard_select`, `reviews_service_role_all`). Only `Active super admins manage reviews` (new) exists; the intended `Service role manages reviews` / `Clients read own reviews` / `Guards read own reviews` names are missing.
- `app.transactions` still carries old disabled policies (`Admins read all transactions`, `Clients read own transactions`, `Guards read own transactions` with `qual=false`) plus `Service role manages transactions` (INSERT) and `Service role manages transactions (v2)` (ALL).
- `public.client_reviews` still carries old policies (`client_reviews_admin/client/guard/insert`); the intended new names are missing.

Classification: **Equivalent-with-drift / partial application.** The review &
transaction tables are RLS-enabled and broadly secured, but repo `031`'s
cleanup/rename was not fully applied and obsolete disabled policies remain.

This scope is **not** included in the pending corrective SQL below because repo
`031` also contains CHECK constraints (`reviews_punctuality_check`, etc.) that
require data validation before any schema change. See §9 for the required
precondition queries.

---

## 6. Task 6 — Migration `030` explicit reconciliation

- **File exists:** yes (`supabase/migrations/030_qg_launch_rewards_critical_rls_repair.sql`).
- **Valid SQL:** yes (idempotent `DROP POLICY IF EXISTS` + `CREATE POLICY`, transactional).
- **In live history:** no.
- **All 16 tables RLS enabled live:** yes.
- **All service-role policies target `service_role`:** yes.
- **Weak PUBLIC admin policies remain:** no (admin policies target `authenticated` with `super_admin` + `is_active`).
- **Anonymous write policies remain:** the "Anon can insert …" policies still exist but are disabled (`with_check=false`, `roles=authenticated`).
- **Audit-log access:** `qg_launch_reward_audit_log` has `Service role manages …` (ALL, service_role) + `Active admins read …` (SELECT, authenticated, super_admin) — role-restricted and active. OK.
- **Live differs from `030`:** yes — a different lineage hardened the admin policies in place under old names and left duplicate/obsolete policies plus one latent public-read exposure that `030` would have removed.

Do **not** blindly re-run `030`. Create a new forward corrective migration (§7).

---

## 7. Pending corrective migration (CREATED ONLY — not applied)

This is the final-state cleanup for the Launch Rewards RLS. It is forward-only,
idempotent, and non-destructive (`DROP POLICY IF EXISTS` only — no table,
column, constraint, or row changes). It must be turned into a real migration
via `supabase migration new <name>` so the CLI assigns the timestamp; do not
hand-write the filename or the history entry.

```sql
-- Final-state cleanup: app Launch Rewards RLS (reconciles repo 030 with live)
-- Forward-only, idempotent, non-destructive. No table/column/row changes.

BEGIN;

-- 1. Latent public exposure — campaigns have no public-read concept.
DROP POLICY IF EXISTS "Public can read published campaigns" ON app.qg_launch_campaigns;

-- 2. Dead public settings read (qual=false leftover).
DROP POLICY IF EXISTS "Public can read settings" ON app.qg_launch_reward_settings;

-- 3. Duplicate public SELECT policies (keep the canonical one each).
DROP POLICY IF EXISTS "Anyone can read public stats" ON app.qg_launch_public_stats;
DROP POLICY IF EXISTS "Anyone can read published updates" ON app.qg_launch_updates;

-- 4. Disabled anon-insert leftovers (with_check=false).
DROP POLICY IF EXISTS "Anon can insert referrals" ON app.qg_referrals;
DROP POLICY IF EXISTS "Anon can insert launch profile" ON app.qg_launch_profiles;
DROP POLICY IF EXISTS "Anon can insert pre-account tokens" ON app.qg_pre_account_tokens;

-- 5. Disabled owner-update leftover (qual=false).
DROP POLICY IF EXISTS "Users update own launch profile" ON app.qg_launch_profiles;

COMMIT;
```

### Verification (run after applying)

```sql
-- Should return 0 rows: no public INSERT/UPDATE/DELETE/ALL on launch-reward tables
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'app'
  AND tablename IN ('qg_referral_codes','qg_referrals','qg_token_ledger','qg_token_redemptions',
                    'qg_launch_reward_settings','qg_launch_invites','qg_launch_campaigns',
                    'qg_invite_rate_limits','email_suppression_list','qg_launch_profiles',
                    'qg_launch_updates','qg_launch_public_stats','qg_pre_account_tokens',
                    'qg_fraud_events','qg_launch_reward_daily_stats','qg_launch_reward_audit_log')
  AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
  AND roles && ARRAY['public','anon']::name[];

-- Should return 0 rows: no duplicate public SELECT policies remain
SELECT tablename, policyname, count(*)
FROM pg_policies
WHERE schemaname = 'app'
  AND tablename IN ('qg_launch_public_stats','qg_launch_updates')
GROUP BY tablename, policyname
HAVING count(*) > 1;
```

---

## 8. Rollback / forward-recovery plan

Because the pending migration is `DROP POLICY IF EXISTS` only, rollback is
deterministic: recreate the dropped policies from their captured live
definitions (captured in §5.1). No data rollback is required.

If any drop is found to break a runtime consumer, forward-recover by re-adding
the specific policy with the intended (hardened) predicate rather than
restoring the obsolete name.

---

## 9. Required precondition queries before ANY `031`-scope work

Do not add repo `031`'s CHECK constraints or rename its policies until these
pass. If any row violates a proposed constraint, document the count and design
a deterministic backfill in a separate migration — never delete the rows.

```sql
-- Reviews rating columns must be NULL or 1..5 before adding CHECK constraints
SELECT 'punctuality_out_of_range' AS check_name, count(*) FROM app.reviews
WHERE punctuality IS NOT NULL AND (punctuality < 1 OR punctuality > 5)
UNION ALL SELECT 'professionalism_out_of_range', count(*) FROM app.reviews
WHERE professionalism IS NOT NULL AND (professionalism < 1 OR professionalism > 5)
UNION ALL SELECT 'communication_out_of_range', count(*) FROM app.reviews
WHERE communication IS NOT NULL AND (communication < 1 OR communication > 5)
UNION ALL SELECT 'appearance_out_of_range', count(*) FROM app.reviews
WHERE appearance IS NOT NULL AND (appearance < 1 OR appearance > 5)
UNION ALL SELECT 'reliability_out_of_range', count(*) FROM app.reviews
WHERE reliability IS NOT NULL AND (reliability < 1 OR reliability > 5);

-- Duplicate active guard payouts (blocks 029's unique index preflight)
SELECT assignment_id, count(*)
FROM app.guard_payouts
WHERE status NOT IN ('failed','manual_review')
GROUP BY assignment_id
HAVING count(*) > 1;
```

---

## 10. Validation plan (gates before production apply)

1. SQL parses successfully (pending migration).
2. Clean local migration build passes (`supabase db reset` in a scratch project).
3. Production preconditions pass (all §9 checks return 0).
4. No destructive operation unaccounted for (drops are policy-only).
5. RLS/grant diff reviewed by a human.
6. Advisors run (Linter, Security).
7. Exact target project reconfirmed (`vnywjfpkepjgclkbcmsj`).
8. Rollback SQL (recreate dropped policies) prepared.

If any gate fails: do not apply. Report "created only" with the blocker.

---

## 11. Remaining drift / blocked items

- Prompt 4A report not available — full drift classification (all Critical/High findings, runtime consumers, storage/realtime) could not be completed.
- Git commit not recorded (no Git access).
- Supabase CLI unavailable — cannot run `supabase migration new`, `db reset`, or advisors; migration filename/history entry must be CLI-generated.
- Backup / point-in-time recovery not confirmable from this environment.
- Repo `031` (reviews/transactions) corrective migration not drafted — requires §9 data validation first.
- Storage/Realtime drift (Task 10) not fully assessed.

## 12. Explicit manual actions

1. Provide the Prompt 4A report (drift map + live inventory) to complete classification.
2. Confirm point-in-time recovery / a fresh backup exists for `vnywjfpkepjgclkbcmsj`.
3. Run `supabase migration new qg_launch_rewards_rls_final_state` and paste the §7 SQL into the generated file.
4. Review the RLS/grant diff, then apply via `supabase db push` (or the project's deploy workflow), stopping on first error.
5. Run §9 preconditions before any `031`-scope work; do not apply `031` blindly.
6. After applying, run the §7 verification queries and advisors, then regenerate DB types and run `tsc`.

---

## Disclosures

- Migrations applied to production: **NO**.
- Production migration history after this work: **unchanged** (36 rows; head `20260813133857`).
- Rows changed in production: **none** (read-only SELECT queries only).
- New migration files created and applied: **none**. One corrective SQL is drafted above as CREATED ONLY.