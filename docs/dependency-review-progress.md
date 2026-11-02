# Remaining dependency review — PR 121

All remaining dependency repairs stay in this draft PR. No further dependency PRs should be split out. Current work is an intermediate checkpoint, not merge readiness.

Completed reviews include completion requests and job drawer cancellation; contact submission duplicate loads and stale pagination; SIA list/statistics request ordering; stable plan-card loading and subscriptions; guard usage/review cancellation; derived matching scores; earnings payout-status memo dependencies; message scrolling during history pagination; stable promo expiry, report date initialization, sidebar route matching and analytics date callbacks.

Focused tests execute the affected hook/load logic with deferred responses. They cover request races, scope changes, unmounting, stable callbacks/subscriptions, matching-score recomputation and scrolling while reading older messages.

Other dependency warnings remain under review. Full lint, types, regression tests, production build and the exact-head GitHub Build Check must pass for the final revision before it leaves draft. No rules are suppressed to reduce the count. Unrelated lint warnings and full-site launch checks are separate scope.
