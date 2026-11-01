# Guard job-detail lifecycle review

## Repairs

Switching job IDs could retain the previous job's application, assignment, invitation and saved-job flags. In-flight authentication, detail and payment-status reads could also update the new screen or redirect after navigation.

Each job selection now owns a request lifetime. Switching or closing the page invalidates that lifetime; retrying supersedes the earlier request. All detail and payment read continuations check that they still belong to the active request. Each load resets relationship flags, client identity, payment data and open dialogs. Failed relationship queries produce the existing retryable booking error instead of being treated as an absent record. Payment queries inspect returned errors before interpreting data.

The stable payment loader is declared before the detail callback and included in its dependencies. No lint rule is suppressed.

## Validation scope

Four new tests execute the actual component load/effect code with deferred responses: relationship reset, late authentication, payment cancellation and spinner ownership, detail retry ordering, and relationship-query failures. Existing booked-job tests retain authorization/transport/not-found assertions and have their loader harness updated for the new dependency and request context.

The branch is based on main after PR 118 and is independent of the pending messaging PR 119. Warning counts for this branch must not be added to PR 119's branch counts without a fresh combined scan.

Application submission and saved-job write handlers, remaining dependency warnings, signed-in browser journeys and backend checks remain separate audit work. This batch does not certify full-site launch readiness.
