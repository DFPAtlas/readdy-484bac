# Behaviour review — payment polling, verification and safety

This batch addresses four of the 76 remaining React dependency diagnostics. Full repository lint is at 0 errors, 595 warnings and 72 dependency diagnostics. No lint rules are disabled. These are targeted repairs, not full-site launch certification.

## Confirmed issues and changes

- Verification setup awaited the authenticated user and then started timers without checking whether the screen had unmounted. Cleanup now invalidates that setup generation. Status responses cannot update or redirect a superseded screen, overlapping status checks are skipped, terminal decisions stop the polling pair, and manual refresh cannot restart timers after cleanup. Polling waits for the route guard to allow access.
- Payment data loading and its interval referenced render-local functions omitted from effect dependencies. Stable callbacks now include their actual inputs. The screen clears prior-job payment state when its loader changes. Generation checks prevent old responses—including manual booking-total retries—from overwriting a replacement job; one request at a time runs per active generation. Cleanup invalidates responses and removes polling.
- Safety assignment loading depended only on `jobs.length`, so replacing one job with another at the same count did not refresh assignments. The effect follows the actual jobs value, discards superseded results, clears the map for an empty set and handles returned query errors instead of treating them as valid empty results.

## Validation

Six focused behavioural tests simulate deferred authentication and database responses, timer cleanup, pending and terminal verification states, same-size job replacements, overlapping payment polls and a late manual booking-total retry. TypeScript passed. Full-suite/build results are recorded in the PR description.

No live application submission, checkout, charge, verification decision, email, function deployment, publication or database change was performed. Financial mutations and booking-total calculations remain on the existing server paths. The local payment-screen hours helper was moved out of the component without changing its calculation; reviewing that calculation is separate from this lifecycle repair.

## Remaining work

72 dependency diagnostics require individual review, including other booking/detail screens, messaging, dashboards and admin loaders. The broader release checklist still includes authenticated and mobile journeys, Deno backend typing, database permission hardening and deployment/delivery verification for earlier PRs.
