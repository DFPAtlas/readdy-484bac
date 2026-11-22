# Admin Agents result handling

## Confirmed frontend fault

The admin Agents page retained a previous healthy result when a retest failed. Its text could report an error while the status indicator and check list still represented the earlier successful read. It also trusted arbitrary endpoint results, allowing wrong-agent, empty, stale or contradictory replies to appear healthy or break rendering. Synthetic tests reproduced the stale-evidence and malformed-reply failures before repair.

The page now clears a card's previous result before requesting a new check. A failed or invalid reply produces an alert, a failed indicator and an accessible Retry button. The validator requires the requested agent/site, one complete result, a recent check timestamp within five minutes of the browser clock, supported statuses, nonempty unique checks and agreement between check, card and overall health. It rejects explicit error payloads even if they also contain a result. A synchronous per-card request lock prevents double submissions; other cards remain independent. Responses and completion handlers from an unmounted lifetime cannot update state.

No operational check or heartbeat threshold on the server changed. The UI continues calling the existing read-only `agent-health-check` endpoint through the signed-in SDK session. No worker is executed, registered or activated. No financial, verification, account or provider record is modified.

## Separate registry finding

Production `app.agent_registry` is genuinely empty. HAL workers continue writing fresh protected `agent_state_snapshots`; that observation does not establish an authoritative configured/active workflow inventory. The admin Agents page uses its three read-only diagnostics directly and does not read the registry. Correcting frontend result handling therefore does not resolve the registry configuration gap.

HAL registration follow-up must use its supported n8n export/list API to inspect current QuickGuard workflow IDs, agent/site configuration and actual active flags. Back up existing exports and registry contents, preserve all schedules/activation/credentials and never copy secrets into registry config. Register only uniquely mapped verified workflows; derive `enabled` from their actual configuration, not a healthy or fresh snapshot. Record sanitized source workflow/version evidence and an audit. Conflicting/missing mappings require review. Test enabled, disabled, stale, missing and conflicting cases before applying an idempotent inventory reconciliation. Do not fabricate healthy status, invoke workers, change activation or alter payment/email/approval behaviour. Verify later Diagnostics and Master snapshots separately.

## Validation and acceptance

Focused tests run the actual page with controlled SDK responses and cover stale successful evidence on retest, malformed/old/wrong-agent/error/contradictory results, duplicate checks, simultaneous requests, independent cards, and unmount retirement. The validator also accepts actual backend-generated healthy/warning/failure responses. All twelve focused frontend/backend tests passed. The full repository suite passed **1,100 tests, zero failures**, with concurrency two. Repository/admin TypeScript passed; lint had zero errors and ten existing warnings. The production build passed with **214 pages**, using unreachable placeholder Supabase settings. The build-generated next-env reference was restored to its original tracked content. No dependency or backend change is required.

This is a frontend repair: merge the PR after checks, import latest main into Readdy and publish. Then verify Run test → current result, failed retest → error with no old green/check list, Retry recovery and navigation during a pending read. Published-site acceptance has not yet been performed. No database migration, Edge deployment or worker activation is required. Full admin sign-off remains open, including authoritative registry configuration.
