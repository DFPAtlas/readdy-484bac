# Delegate the legacy admin helper

## Finding and scope

A fresh production catalog review found identical active-admin/MFA decision bodies in `public.is_active_admin()` and `app.is_active_admin()`. Both are owned by postgres. The public copy is flagged by Security Advisor for authenticated execution of a security-definer function. It has 51 policy dependency edges across 42 distinct policies, as well as string-based routine callers; revoking access or removing it would break existing callers.

The proposed migration keeps the public function's identity, signature, owner and grants, replacing its duplicated privileged implementation with a security-invoker delegate to the existing app helper. It preserves the public copy's volatile classification and uses an empty search path with an explicit app-qualified call. The app helper and all policies/callers remain unchanged. This reduces the duplicate definer context; it does not remove the existing app helper or its current API availability.

## Preconditions and verification

- Live metadata confirmed the bodies match, authenticated/backend roles already have app-schema usage and helper execution, and the anonymous role cannot execute the public copy.
- The migration aborts for missing/different helpers, unexpected ownership/return contracts, mismatched original bodies, an unexpected prior invoker implementation or missing caller privileges. It verifies preservation of the public function's object identity, owner and grants after replacement.
- Isolated PostgreSQL regressions compare decisions and policy access before/after for ordinary users, active admin with/without MFA, inactive admin, absent claims, anonymous and backend roles. They exercise owned payment reads, admin reads/writes, a legacy routine caller, dependency/ACL preservation and reapplication. Invalid prerequisites leave the original public helper intact.
- PostgreSQL documents that CREATE OR REPLACE preserves ownership, permissions and dependent objects; SECURITY INVOKER uses caller privileges. See [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) and [Supabase policy helper guidance](https://supabase.com/kb/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw).

## Release status

This is a proposed database-only repair. It has not been applied to production. A hosted isolated rehearsal has now passed against copies of the 42 dependent policies across 28 fixture tables. The test helper bodies used the same active-admin/MFA predicate with the admin table redirected to isolated synthetic rows. Existing checkout tables and policies were not modified. Production rollout still needs the recorded preflight checks and post-deployment verification. In particular retain the MFA, disabled-admin and owner-access checks from the regression suite. No real payment or support email is needed for these checks.

The [flagged advisor rule](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) should no longer match the public function after it becomes an invoker; the hosted rehearsal confirmed that warning disappears after the delegate migration. The separate pg_net extension warning remains outside this change.

If a controlled rollout fails, restore the captured original public function definition via CREATE OR REPLACE, preserving its owner and grants. This restores the existing duplicate-definer implementation and its warning. Do not drop either helper or revoke caller grants as a rollback shortcut.

No frontend or Edge Function changes are included. PR 146 was separately closed as obsolete after confirming its legacy public push table has already been removed.


## Hosted rehearsal result — 18 November

- Test Batabase (PostgreSQL 17.11): baseline, delegate and rollback all passed eight actor/MFA combinations, 27 policy-backed admin read paths, owner billing reads, admin writes, legacy routine calls, absent-claims denial, anonymous denial and backend access.
- The legacy function retained its OID, owner, ACL and 51 policy dependency edges. The function became a schema-qualified invoker delegate with an empty search path; rollback restored its original implementation and the same decision results.
- Security Advisor reported the public security-definer warning in the prepared baseline and omitted it after delegation. Fixture cleanup removed the isolated schema and the two helpers, which had not existed in the partial test database before rehearsal. Test migration history remains as evidence.
- This fixture copies the dependent policies and exercises representative paths. It is not a complete staging clone or browser/payment UAT. No real user account, checkout fixture, payment or email was modified.

Review follow-up: the preflight compares trimmed source bodies exactly, preserving whitespace inside SQL literals. An additional regression rejects a changed MFA string. The live source bodies match exactly. Hosted rehearsal covered the unchanged delegate behavior; this stricter preflight was verified by the isolated regression suite.
