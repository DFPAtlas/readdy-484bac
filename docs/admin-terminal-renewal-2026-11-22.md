# Terminal subscription renewal metadata repair

## Confirmed defect and scope

The cancelled Client Starter sandbox lifecycle fixture `7a010528-5acb-431f-ae27-50def502fe79` still had `auto_renew=true`. Both the merged and deployed `enhanced-stripe-webhook` cancellation branch set `status='cancelled'` without clearing the column, whose database default is true. Other provider-state writes can leave the same contradiction. Stripe was read only: sandbox account `acct_1SYmuoIMkpwfAEDT` confirms subscription `sub_1UMtnGIMkpwfAEDTPjI4GqFt` is canceled, belongs to customer `cus_VNf6NZ3ZsI72dN`, uses the recorded GBP 49 Starter price, and is marked `purpose=quickguard_lifecycle_uat` on test clock `clock_1UMtllIMkpwfAEDTMvjM9Avs`.

The database guard `app.normalize_terminal_subscription_renewal()` forces `auto_renew=false` when an inserted or updated subscription has status `canceled`, `cancelled` or `incomplete_expired`. It runs before inserts and status/renewal-flag updates, including writes that omit the flag or explicitly send true/null. The status itself and all nonterminal renewal flags are preserved. The function has invoker rights and an empty search path. No new table privilege or browser function-execute privilege is granted. Existing entitlement-sync and updated-at triggers remain in place.

This preserves compatibility with deployed writers without redeploying or replacing the payment webhook. The migration defines the guard only; it does not sweep historical records or call any provider. Active, trialing, delinquent, pending-cancellation and complimentary access are outside the terminal correction. A deliberate later transition to a nonterminal state keeps the writer's supplied flag; this migration does not grant access or declare a subscription paid.

## Guarded existing-record correction

`scripts/ops/20261122-reconcile-cancelled-starter-renewal.sql` checks the exact fixture user/client/subscription, cancelled state, price, currency, provider references, original cancellation date and inactive cancelled entitlement. It changes only `auto_renew` and the normal update timestamp, verifies the complete remaining subscription/profile/entitlement records, and inserts one admin audit. Changed evidence or an audit failure aborts atomically. Repeats do not write another event or touch the timestamp.

Migration **20261122223852** is deployed. The trigger definition, function body, invoker rights and execution privileges were independently read back. The correction passed a production rollback check, then application and repeat checks. Audit **4ecd6dde-090d-467b-b959-85f128d6131e**, at **22 November 2026, 22:39:02.484033 UTC**, records true → false and the independent sandbox evidence.

Protected data retained combined fingerprint **0856439c12e504160c71150e895a0a72** before, after rollback and after application/repeat. This covers the target subscription excluding its two intended fields, full profile and entitlement rows, every other subscription, and all subscription-payment rows. Audit count was zero after rollback and one after application/repeat. The historical cancellation timestamp, simulated test-clock periods, paid history, plan/price/provider IDs and inactive entitlement were preserved. No Stripe/Auth/email/refund/payout action or webhook replay occurred.

## Validation and remaining work

The five new PostgreSQL tests passed, including default/true/null terminal writes, cancellation aliases, service-role execution, unchanged nonterminal flags, retained evidence, repeat safety, changed-identity rejection and late audit-failure rollback. The full repository suite passed **1,078 tests, zero failures**, with test concurrency two. PR243 merged independently during validation; the branch was advanced to that main without changing its checkout repair, and its accounting tests plus the existing subscription lifecycle tests passed against the integrated source. Focused lint and `git diff --check` passed. No application bundle, dependency, provider configuration or Edge Function changed for this repair; no separate local frontend build or TypeScript run was needed for the SQL-only change.

Security advisors are unchanged: four informational service/private tables with RLS and no browser policies, and the existing pg_net-in-public warning. No Readdy publication is required. The retained cancelled fixture can still produce HAL terminal/cleared-entitlement findings; the repair does not claim those warnings should disappear or authorise account closure. Full admin sign-off remains open.
