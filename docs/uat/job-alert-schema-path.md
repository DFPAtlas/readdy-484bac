# Job-alert schema and in-app delivery

The production API exposes app, storage and graphql_public. The deployed job-match email handler used a service client with the default public schema for preference reads and notification writes. Preference lookup errors were ignored and an accepted email could therefore have no durable guard notification. The controlled QA probe confirmed provider delivery with no corresponding notification row.

Use the canonical app schema for the service client and stop delivery when notification preferences cannot be verified. Explicit opt-outs remain terminal suppression. Emit the existing job_match event type consumed by guard realtime toasts, and report/log an unconfirmed notification write separately from a genuinely accepted email so a notification failure does not trigger duplicate email delivery. Require a provider receipt before creating the in-app notification.

Validation: 40 focused handler/queue regressions passed. New request-handler tests cover app-schema routing, persisted job_match shape, opt-out suppression, preference lookup failure, missing provider receipt and separate notification failure reporting. The final five handler tests were rerun after moving receipt validation ahead of notification creation. No schema, plan, billing or authentication permissions change.

Deployment: deploy only send-job-match-email with its existing verify_jwt setting. No frontend publish or database migration is required. Historical missing notification rows are not backfilled automatically.

