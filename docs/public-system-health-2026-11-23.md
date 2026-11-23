# Public health report consistency and unknown evidence

On 23 November the live public `system-health` endpoint still used SMTP-only configuration and returned email not_configured while the private admin endpoint recognised the configured Resend API. It also classified every unsuccessful Stripe probe as unhealthy and returned zero counts when database queries failed. Those defaults could conceal missing evidence.

The deployed v32 source already used `app` for business tables and `public.cleanup_log` for cleanup history. The GitHub file lacked that schema correction. The exact deployed baseline is preserved in the preceding commit, and the repair retains those bindings.

## Result

- Reuse the existing shared email/Stripe checks, including Resend recognition, complete SMTP validation, bounded Stripe GET and explicit credential/scope/rate/unknown failures. This changes no credential or key permission.
- Read business counts from the app schema with exact head-count queries. A failed/thrown, missing, malformed or invalid count is null. Combined failed-payment counts are null if either source is unconfirmed; no partial total is presented as complete.
- Expose additive metrics/cleanup check statuses. Unknown counts or cleanup evidence cannot produce overall healthy. Known failed email/payment counts degrade health; unread alerts remain informational.
- Check both cleanup queries for errors and validate returned records. Failed/unreadable/absent completion history remains unknown; a recorded failure remains degraded. Preserve the existing last-run/last-failure shape and strip raw database/provider errors.
- Compute overall severity once so a Stripe error cannot downgrade a critical database failure. An unconfirmed database query or missing server configuration returns critical/HTTP 503. A degraded configuration/permission result remains HTTP 200 with an explicit degraded JSON status, as appropriate for consumers which distinguish a configuration problem from an outage.
- Preserve GET and POST readers; support HEAD, bounded read-only queries, OPTIONS/CORS and no-store responses. Unsupported methods return 405 before database/provider access.

The normal JSON envelope and metric names remain. Numeric values still represent confirmed counts; null now explicitly represents unconfirmed evidence. This is an intentional correction of the former false-zero error case. Healthy response shape and public availability remain compatible. The existing unused SystemHealthWidget source was not changed or added to any admin route.

## Verification and limits

Regression tests execute the actual handler and reproduce the original Resend/count failures. They cover confirmed zero/nonzero counts, either payment source failing, null/invalid counts, cleanup errors/no history, provider status classes, severity precedence, configuration/HTTP methods, source schemas and absence of secret/raw error output. They also pass actual public-response payloads through the repaired launch-runtime assessor to prove a healthy report can pass and degraded/unknown evidence remains unverified.

No schema, dependency, JWT setting, credential, billing identity, eligibility, notification or job state changes. The endpoint remains public because deployed v32 already has JWT verification disabled. No new public resources or secret fields are added. Existing admin MFA/role gates remain unchanged. No cleanup or financial worker is invoked: only existing SELECT/count operations and a read-only Stripe balance GET are used.

The Stripe Balance-read permission issue remains a separate open configuration item; reporting access_denied does not resolve it. Cleanup history is recorded tracking, not proof of backup restore or complete scheduler execution. Full recovery, real document/approval evidence, cross-account isolation and controlled final live payment/refund UAT remain separate.

Deploy system-health plus its shared admin-service-health dependency, retaining the current public JWT configuration. Compare both deployed files with tested source. Live verification checks the anonymous JSON response; no frontend publication is required. Keep the exact v32 baseline available for reviewed rollback, which would restore the reporting defects. Validation and deployment results are recorded in the main admin repair log.
