# Launch readiness runtime evidence and decision validation

The live admin checklist reported **Pass — Required Edge Functions deployed & healthy** with **Core runtime healthy (status: degraded)** on 23 November. The same condition was independently confirmed in deployed launch-readiness v34 and reproduced by executing its handler with a degraded response. A single core-runtime response cannot attest every Edge Function's deployment or authorisation.

A second regression reproduced HTTP 200 and a saved GO when the browser supplied empty or forged results, even though current server checks remained unverified. Both issues are repaired together because a truthful runtime check must also survive decision submission.

## Result

- The existing `edge_functions` ID remains compatible, with the narrower label **Core runtime health probe**.
- A degraded response is **not_verified**. A fresh critical/unhealthy response fails. HTTP, network, JSON, missing-field, unknown-state, inconsistent-service, stale and future-evidence failures cannot pass.
- Passing requires a valid timestamp within five minutes (at most one minute of future clock skew) and healthy database, Stripe and environment checks plus configured/healthy email. The request receives an eight-second abort signal. Notes state that individual deployments and authorisation need separate checks.
- GO and CONDITIONAL GO re-evaluate automatic checks and reapply stored manual signoffs on the server. They store those authoritative results, never the submitted browser snapshot. Current critical failures/unknown states refuse either positive decision. Warnings refuse unqualified GO and remain permitted for CONDITIONAL GO, matching the existing checklist rules.
- Confirmation must be the boolean `true`. Existing admin/finance permissions, warning-compatible conditional decisions and the NO-GO recording path remain intact.

## Preserve the deployed version

The starting GitHub file lacked v34's existing caller-JWT Auth client and manual www-to-apex evidence check. The deployed file was read in full, compared, and retained before this repair. Those changes are included so a later deployment from main cannot undo them. No key, role, JWT-verification setting or redirect implementation is changed.

Strict checking against actual Supabase JS 2.39.3 types also exposed three `.catch()` calls on PostgREST builders, which are thenables without that method. Those calls could turn a successful decision/signoff/retirement write into a false failure response. A small awaited activity-log helper preserves the intended best-effort behaviour and logs a generic failure without exposing provider errors. A regression uses a real-shaped thenable without `.catch()` and covers returned and thrown audit errors. Invocation headers are captured after the existing environment guard so their required string types remain correct.

## Verification and limits

Eight focused tests execute the actual Edge handler, including malformed/contradictory/stale states, eight-second signal forwarding, empty/forged GO input, role/confirmation denial, preserved v34 redirect/Auth checks and saved-decision audit-error handling. The extracted decision branch also proves a successful authorised server-result save and refusals before writes on warnings/unverified/read failures. Full-suite/type/lint and live read-only acceptance evidence are recorded in the delivery report.

This repair changes readiness interpretation and submission validation. It does not grant launch approval, change old signoffs/decision history, fix Stripe key permissions, establish RLS policy effectiveness, or provide missing guard documents/recovery evidence. No production GO/signoff/retirement action should be submitted to test it. Live acceptance uses only the existing read-only Recheck control.

Backend-only: deploy launch-readiness with JWT verification retained and exact source readback. No Readdy frontend publication, migration, financial action, mail send or HAL access is required. Retain before/after readiness and financial fingerprints. The original deployed v34 file is preserved in the preceding baseline commit for reviewed rollback; rolling back restores the two reporting/submission defects.
