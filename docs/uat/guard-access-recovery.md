# Guard access recovery

## Confirmed defect

The shared `useGuardGuard` ignored Supabase query errors. A failed guard lookup
could settle `loading=false, allowed=false` with no recovery state, while the
dashboard and other consumers continued displaying an access spinner. Rejected
or never-settling requests had no bounded recovery. The hook also never reacted
to later account changes. The outer `GuardAuthGate` likewise lacked rejection
and timeout recovery and could retain the preceding route's allowed render.

The production smoke test observed an initial direct-dashboard access stall,
followed by successful normal email/password sign-in. This repair addresses
reproduced code paths; it does not claim a proven cause for that specific stall.

## Result

- The shared check handles failed auth/profile reads and missing sessions or
  profiles with a settled recovery state. All eleven hook consumers can render
  Retry access check and the normal guard sign-in link before loading screens.
- Requests use the existing deadline helper. Retry starts a fresh check.
- Sign-out and account changes retire the previous access immediately. Late
  reads cannot authorize the retired account or update an unmounted hook.
  Profile results are confirmed against the current authenticated identity.
- Auth SDK work runs outside its callback. Same-owner refresh and sign-in do
  not reset healthy access; a newly hydrated initial session can recover.
- The outer gate has bounded error/retry handling, withholds previous route
  content during new checks, and retires results on account changes. Normal
  login/onboarding forms stay mounted during their own sign-in transitions.
- Existing admin, client routing, suspension, onboarding, verification and
  dashboard-access decisions remain in place. RLS and server authorization
  remain unchanged. No credentials, grants, SIA approvals or billing records
  are modified.

## Validation

The regression initially failed against the original hook: a guard query error
returned no error/retry state. The new dependency tests exercise auth/profile
failures, recovery, missing sessions/profiles, identity changes, sign-out,
initial-session hydration, token refresh, late/unmounted replies, timeouts,
outer-gate routing decisions, login lifetime and rendered retry controls.

Focused guard regressions, TypeScript and changed-file lint passed. Final
repository regression and build results are recorded in the pull request.

## Deployment and acceptance

Frontend only: merge, pull into Readdy and publish. No migration or Edge
function deployment is needed. After publication, use normal QA guard sign-in
and revisit dashboard, messages, history, notification preferences, support
and bank settings. Check controlled failure/retry paths in an isolated test
environment rather than interrupting production services.

This is not production browser acceptance of the unpublished repair. Full
Guard Elite sign-off still needs eligible controlled production job conditions
and a live guard payout account. Keep live payment/refund last. PDF statements,
profile-boost placement and token checkout redemption remain planned.
