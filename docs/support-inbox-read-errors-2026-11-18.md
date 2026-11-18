# Support inbox read errors

Guard/client support loads ignored Supabase returned errors and converted missing data into empty arrays. The admin queue logged ticket failures and ignored requester/job lookup errors. Background refresh failures could still look successful, with no visible retry state.

Shared read helpers now reject failed/malformed auth, profile, ticket, related-job and requester reads. Profile failures are not treated as sign-out; only a confirmed absent user redirects to login. Role gates, owner query filters and database permissions are preserved.

The three inboxes show an error/retry state after failed initial or background reads. Unknown counts display a dash and the customer refresh indicator marks failure. Failed refreshes do not advance the last-successful time. Old requests and requests completed after cleanup cannot change state. Selected/bulk actions are cleared on failure. Customer error states that occur before the existing role gate resolves offer a safe full-page retry without exposing inbox data.

The client inbox's realtime subscription now waits for a real client ID and is separate from initial loading, avoiding a null-owner subscription and a repeated initial load when the ID is first populated. Read results are committed together after all required sources succeed, retaining the guard/client requester distinctions from PR 143.

Verification covers returned errors and malformed data, valid empty responses, ownership filters, enrichment failures, superseded/unmounted results, silent refresh failure and retry recovery, plus rendered error states. The guard-ticket PostgreSQL ownership regression is retained.

No migration or Edge Function deployment is required. This frontend change needs merge, latest-main import into Readdy and publication. No ticket, email, payment or live account was created by verification. Signed-in browser UAT remains outstanding; the existing global role guards and ticket mutation flows are outside this repair.
