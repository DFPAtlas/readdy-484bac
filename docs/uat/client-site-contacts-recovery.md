# Client Site Contacts recovery — C12

## Problem and result

The profile silently treated contact read errors as an empty list. Contact updates and deletes checked only the returned error, so a zero-row mutation could announce success, and a thrown request could leave Saving stuck. This repair gives Site Contacts its own complete owned read and Refresh/Retry state, preserves drafts after failures and requires the exact owned returned row before confirming a write.

The loader projects only contact fields, reads ordered 200-row pages and rejects malformed, foreign, partial or non-advancing results. Offset pagination is not a transaction snapshot during concurrent changes; Refresh obtains the current list. Unknown/error/loading states never render as a successful empty list.

Create uses one random draft ID retained across retries. A unique-key insert replay is successful only after reading the same owned ID and matching every submitted normalized value. It never upserts or overwrites mismatched data. Update and delete filter both contact ID and client ID and require one matching returned identity. A zero-row result is unconfirmed. Optional text can remain blank, and the existing default flag is preserved without introducing a uniqueness rule.

The active owned client is checked before operations and authenticated identity is checked afterwards. Existing database ownership and closed-account policies remain authoritative and unchanged. Component request/lifetime guards suppress stale callbacks after account changes, client changes and unmount. Same-user sign-in/focus events preserve drafts. Synchronous locks prevent duplicate submissions, thrown requests release Saving, and failed/unconfirmed writes keep the form or card available for recovery. Saved cards use the returned persisted values.

## Validation

- Twelve focused tests execute the actual loader/component with a schema-aware database fixture: 405 owned contacts across three pages plus a foreign row, load failures and Retry, exact write confirmation, validation/optional blanks, lost-reply replay, failed/zero-row deletes, rapid clicks, account changes, same-user draft preservation, unmount and stale reads.
- Repository TypeScript, admin/financial checks, lint, all 710 repository unit tests and the final production build pass. Lint retains eight existing blog-image warnings.
- Read-only production metadata confirms the five supported contact types, current columns, RLS ownership/closure policies and zero contacts owned by the test company. The global contact count is one; no other contact content was read.

No production contact create/update/delete was submitted. No migration, Edge Function, dependency, secret, grant or policy deployment is required.

## Controlled acceptance still required

After merge, import latest main into Readdy and publish. In a labelled synthetic account, create each supported contact type, reopen and verify persisted optional values/default flag, edit and reopen, delete and refresh, cancel deletion, and exercise load/save/delete failures and Retry. Verify a lost create acknowledgement does not duplicate a contact and that account changes hide the former account's data. No email or other delivery is introduced by saving a contact.

Local mocks and read-only metadata do not establish published mutation acceptance. C12's earlier optional Website/Description and export checks remain scoped passes; broader profile/contact mutation acceptance and public launch remain open.
