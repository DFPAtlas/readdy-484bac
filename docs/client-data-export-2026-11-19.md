# Client data export — 19 November 2026

## Problem and behavior

Preview previously loaded only selected categories, so previewing unselected Job History falsely showed no records. Guard data came from a private embedded relationship and defaulted missing verification to false, missing ratings to zero and names to blank. Some all-category queries used nonexistent `saved_sites.site_type` and `subscription_payments.stripe_subscription_id`, and read errors silently became empty arrays. Heterogeneous payment rows lost subscription-only fields in CSV. Internal ticket notes and raw access links were also selected unnecessarily.

The modal now previews only the requested category without changing selection. The same loader supplies preview and download. Each source is paginated with stable ordering, and any selected source failure prevents a partial download. Preview and export expose Retry. Older preview requests and closed/unmounted exports cannot overwrite current state or trigger a later download. Category wording is singular/plural correctly and selection/preview controls have distinct accessible names.

## Explicit scope

| Category | Included | Excluded or clarified |
|---|---|---|
| Company Profile | Explicit company, contact, billing/address and recorded plan fields; nested owned site contacts | Internal notes, provider/auth settings; this is not a blanket data-access/GDPR-completeness certification |
| Job History | Owned non-deleted jobs, including legacy null deletion flags | Deleted jobs; assigned_count is derived from distinct non-cancelled assignments, with recorded_assigned_count retaining the stored cache |
| Selected Guards | All assignments on those jobs; owned safe profile endpoint supplies name, recorded licence/verification/rating and active-account flag | Private guard phone/email/address/documents/financial data; a missing profile/verification/rating is explicit unavailable/null, not false/zero |
| Payments & Invoices | Owned transaction ledger and user subscription-payment history, separately typed; recorded refund fields and subscription periods | Provider identifiers and raw receipt/invoice access URLs; retained cancelled/deleted-job payments remain, and these rows are not provider-issued documents |
| Support Tickets | Owned, non-deleted ticket records, descriptions and client-visible resolution notes | Internal admin notes, evidence links and bridge metadata |
| Messages | Messages sent or received by the authenticated user, including participant IDs/types for conversation grouping | Other users' conversations and unrelated profile/contact data |
| Saved Sites | Owned sites without deleted_at, including archived sites | Deleted/foreign sites; queries use actual deployed columns |
| Documents List | Owned metadata, filename/type/size/description/expiry/timestamps | File content and raw storage/signed access URLs |

The loader verifies the current authenticated user and matching owned company before any category read. Explicit column projections are applied again when serializing, so extra fields in a returned row do not leak into downloads. Guard lookups use the existing owner/job/assignment-checked endpoint rather than a direct private guards relationship. That endpoint now paginates assignments and batches profile IDs; its existing field whitelist, authentication, closure/ownership checks and verify_jwt=false configuration with in-handler authentication are unchanged. No grants, RLS or schema changes are required.

## File formats and safety

JSON preserves selected category arrays, empty arrays, record counts and the documented scope. CSV is one rectangular UTF-8 BOM table with export_category and export_row_type, a union of all record columns, and an explicit empty_category row for each selected empty source. Record category fields such as a ticket's technical_issue category remain separate. Columns present only on subscription payments survive. Nested values use JSON, every cell is quoted, line endings are CRLF, embedded quotes/newlines round-trip and spreadsheet-formula-leading strings are prefixed with an apostrophe. Boolean false and numeric zero remain actual recorded values; JSON null and blank CSV cells mean unavailable/unrecorded.

The actual modal's generated Blob bytes are tested and parsed for CSV/JSON. Print View inserts serialized content using textContent, so company or message text is not interpreted as HTML. A blocked popup is an error with Retry, not a success. Downloads start only after every selected source has loaded.

## Read-only production targets

Equivalent queries under the existing authenticated client role return: profile 1, jobs 9, assignment rows 8, payments 11 (9 job plus 2 subscription), tickets 3, messages 0, sites 1 and documents 0. Contacts are empty. These are published retest targets, not a completed live download pass. The inactive assigned guard's recorded verification should remain true rather than the previous fabricated false.

All ten exact source projections were also executed under the authenticated client role and returned the same counts without exposing record contents. All 651 repository unit tests and the final 17 focused export/assigned-profile checks pass. Repository TypeScript, admin/financial checks, changed-code lint and final local production build pass. The build has only the eight existing blog-image lint warnings. No dependency changed. Controlled Blob byte parsing is not a production browser-download pass.

## Release acceptance

Deploy the updated get-client-assigned-guards function before publishing the dependent frontend, preserving its current in-handler authentication and verify_jwt=false setting. Merge the reviewed PR after green checks, import latest main into Readdy and publish. No migration, secret or dependency change is needed.

Retest unselected Job History/Selected Guards previews, unchanged selection, nine jobs/eight assignments and correct inactive-guard identity/recorded verification. Export all eight categories to both CSV and JSON and parse actual downloaded bytes against the counts above; confirm two explicit empty CSV categories and matching JSON counts. Confirm no internal notes/private guard contacts/access links are present. Controlled live fault-injected Retry, populated messages/documents/contacts, missing-profile states and large live datasets remain separate acceptance.

No profile, job, assignment, ticket, message, payment, refund, subscription or notification was created or modified during this repair. No private production CSV/JSON was delivered or saved as a report attachment. Automated fixture content is synthetic.

## Separate finding retained

Schema inspection also confirms that editing Company Description in Company Profile submits clients.description, which does not exist in the deployed schema. An unchanged undefined field may be omitted during JSON serialization, so this is specifically a description-edit save problem, not evidence that every unchanged save fails. It remains separate C12 controlled-save follow-up; no production save was attempted and this export PR does not change company-profile writes.
