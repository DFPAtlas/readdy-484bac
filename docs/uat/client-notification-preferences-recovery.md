# Client Notification Preferences recovery — C12 follow-up

## Problem and result

The parent profile treated failed preference reads as editable defaults. The child used those props only to initialise state, ignored errors in its save-time existence lookup, accepted zero-row updates as success, and could remain Saving after thrown requests. Its Immediate button persisted `immediate`, whereas existing email services and the guard settings use `instant`.

The section now owns a verified, explicit-field read for the authenticated active client. Loading/error states hide editable choices and show Retry. Only a confirmed missing row gets the existing unsaved defaults; nullable legacy fields use their schema defaults and recorded false opt-outs remain false. Saved legacy `immediate` is displayed as Immediate and future explicit saves write `instant`. Daily, Weekly and Off represent `daily`, `weekly` and `none`. Unknown/malformed values fail safely before edits.

Saves validate and whitelist the eight client alert booleans and frequency, check the owned client, and fail closed on an errored existence lookup. Existing rows update by preference ID and user ID; missing rows insert by the authenticated user ID. Exactly one returned owned row with matching normalized choices is required. A concurrent insert conflict is confirmed only after an owned read matches all submitted choices; it is never blindly overwritten. Repeating a save after a lost create reply uses the existing unique user row. Guard-only choices and digest bookkeeping fields are excluded from reads/writes.

Failed/unconfirmed saves keep choices and release Saving. A synchronous lock and disabled fieldset prevent rapid/changed pending submissions. Reload saved preferences requires an explicit discard decision if choices are unsaved. Auth/request/client/lifetime guards prevent old results and toasts returning after context changes. Same-user sign-in events preserve drafts; signing back into the expected account after sign-out can recover through a verified read. Account Health counts preferences as configured only after a confirmed saved row, including an all-off configuration; unknown/error/default-only states are not Complete. Existing payment-method readiness remains unchanged.

The adjacent existing password-reset request now validates the current auth identity/email, handles thrown requests, locks repeats and retires late callbacks. It does not depend on successfully reading notification preferences. A successful API request is labelled requested, rather than claiming mailbox delivery. No reset request was made against production.

## Verification and limits

- Twelve focused new tests execute the actual helper/component with a schema-aware fixture. They cover opt-outs, all four canonical frequencies and the legacy alias, missing/null/malformed/failed reads, exact mutations and zero rows, protected guard/digest fields, lost replies/concurrent insert, Retry and draft/discard behavior, rapid clicks, stale reads, account/client/unmount changes, sign-back-in recovery, accessibility and reset-request failure cleanup.
- The nine existing payment-method/Account Health regressions pass with the new preference dependency. Repository TypeScript, admin/financial checks, full lint, all 722 repository unit tests and the final production build pass. Lint retains eight existing blog-image warnings.
- Read-only production metadata confirms current columns, defaults, unique user_id, enabled RLS, owner SELECT/INSERT/UPDATE/DELETE and the restrictive closed-account policy. An authenticated-role owned query for the test company returns zero saved preference rows. No preference or business record was changed.
- No migration, Edge Function, dependency, secret, grant or policy deployment is required.

Saving these settings establishes persistence only. It does not establish that each alert service implements its category, email frequency or SMS choice. Essential account/payment mail may be independent. No sender/queue/provider behavior was changed or invoked, and email/SMS delivery remains separate controlled UAT.

## Controlled acceptance after publication

After green checks/review, merge, import latest main into Readdy and publish. In a labelled synthetic account, verify absent defaults are unsaved, change every category both ways, save/reopen, preserve false values and test Immediate/Daily/Weekly/Off. Check legacy alias display/canonical save, Account Health, failed reads and saves with Retry, cancelled/confirmed draft discard, lost save acknowledgement, rapid clicks and account switching. Confirm guard-only settings/digest timestamps remain unchanged. Delivery/opt-out enforcement, SMS, password recovery through actual email and the broader security/profile workflows remain unsigned off. Public launch remains on hold.
