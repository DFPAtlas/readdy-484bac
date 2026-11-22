# Guard sandbox application and invitation boundaries

Executed 22 November 2026, 20:52–20:53 GMT, against the isolated `qg-e2e-sandbox` branch (`alfwwggavmyerjyqumuo`). The user explicitly chose sandbox only. No production data, Stripe mode, subscriptions, prices or financial actions were changed.

## Scope

`scripts/uat/guard-sandbox-boundary-rollback.sql` exercises the deployed native application RPC as `service_role` with the QA guard actor and `p_is_admin=false`; invitation creation and decline run as `authenticated` with the existing QA client/guard identities through database RLS. This is not an Edge JWT/HTTP or browser acceptance test. Earlier completed browser lifecycle evidence remains separate.

The existing reviewed sandbox guard receives temporary synthetic licence fields and the catalogue Elite entitlement only inside a transaction. Its reviewer and approval status are not changed. Usage is seeded to 39 for the boundary test; this does not represent 39 actual applications. Three operator-inserted, unpaid synthetic jobs test application logic, not client job-posting quota or actual shift/service delivery. No trigger or delivery control is enabled by the script. Every write rolls back.

## Results

All 15 receipt checks passed:

| Check | Result |
|---|---|
| Isolation and fixture preconditions | Exact sandbox identities, closed prior audit, disabled production-target trigger, zero active cron and absent prior entitlement/usage verified. |
| Owned client invitation creation | Both invitations created under authenticated client RLS; replay returned the original ID. |
| Wrong application actor | Denied without consuming quota. |
| Expired job | Denied without consuming quota. |
| Final Elite application | Seeded usage 39 became 40; remaining zero. |
| Duplicate application | Denied; one application remained. |
| Exhausted invitation acceptance | Application 41 denied atomically; no application inserted and invite stayed pending. |
| Existing application invitation | Accepted at usage 40 and replayed the same application without another charge. |
| Cross-job invitation | Rejected. |
| Owned guard decline | Saved under authenticated guard RLS. |
| Decline retry | Updated zero rows. |
| Immutable invitation fields | Message mutation rejected with insufficient privilege. |
| Declined invitation acceptance | Rejected as no longer pending. |
| Decline quota | Usage remained 40. |
| Invitation queue dedupe | Exactly one unsent invitation email row per invitation before rollback. |

The read-only quota response at 40 reports `allowed=true` and `remaining=0`; the actual application mutation correctly rejects attempt 41. No claim that the read-only flag authorizes another application is made.

## Independent rollback verification

At 20:53:02 GMT, guard, client, Auth and original closed-audit row hashes exactly matched the pre-test hashes. New jobs, applications, invitations, matching email queue rows and notifications all counted zero. Guard entitlement, usage and Auth sessions remained absent. Active cron remained zero and the production-target notification trigger remained disabled. The closed browser runner and original acceptance controls were not reopened.

## Remaining production gates

Production Daniel remains active with its original sandbox payout link and no recorded reviewer. Read-only Stripe checks found the live platform enabled for charges, payouts and transfers, with no due requirements, but its connected-account inventory was empty. The saved guard account exists in sandbox with enabled capabilities and unresolved identity requirements. This does not certify a live-ready guard.

Full production lifecycle and payout readiness remain open; live payment/refund stays last. PDF statements, profile-boost placement and token checkout redemption remain planned until implemented and tested. No product defect was found by these boundary tests, so no new frontend publish is required for this evidence-only change.
