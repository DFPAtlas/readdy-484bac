# Optional company website — C12

Company Profile inserted https:// when the saved optional website was absent.
The browser's native URL validation rejected that incomplete value before the
save handler ran, so an unchanged profile could not save without manual clearing.

## Changes

- Missing, empty and whitespace-only values render as an empty optional URL
  field. Legacy bare http:// or https:// placeholders also render blank; the
  placeholder is never reinserted after a successful blank save/reopen.
- Complete domain names saved by older forms retain their HTTPS-prefixed form
  compatibility. Invalid non-empty stored values remain visible for correction
  rather than being silently erased. Complete stored HTTP(S) values are retained.
- Submission trims optional whitespace. Blank is stored as blank; complete
  HTTP(S) URLs are parsed and normalised. Incomplete, unsupported or credential-
  containing values are rejected before a write. The native optional URL input
  remains, with a connected label and an explanation that blank is allowed.
- The saved payload and parent update use the same normalised website. The local
  field adopts that value unless edited while saving; newer edits are retained.
  The existing client-ID update scope remains. Success requires a
  returned matching row ID; errors, zero updated rows and thrown failures show
  an error, never announce success, and always release the Save button for Retry.

## Validation and release

Three focused integration tests exercise the real component's rendered URL
input and actual submit handler against controlled database responses: absent/
placeholder unchanged save/reopen, complete and invalid URLs, legacy domains,
consistent saved/callback values, owned-client scope and failure/Retry behavior.
No live profile was saved. The broad run passed all 628 unit tests; the three
final focused component/save checks pass, including legacy domains with ports
and edits made while saving. Repository typecheck and admin checks pass. Lint
has zero errors and eight existing blog-image warnings; changed code also lints
clean. The final production-build result and GitHub Build Check are recorded in
the PR. An intermediate build was stopped to include the final save-state guard
and is not used as pass evidence.

After checks/review and merge, import latest main into Readdy and publish.
No database migration or function deployment is required. Retest the existing
blank website after opening/reopening the Company Profile tab and inspect native
input validity. Unchanged/blank/valid/invalid submission acceptance remains
controlled UAT; do not claim a live profile mutation pass from an input rendering.
Keep C12 open until the published signed-in display and controlled save checks
pass. C15 payment-method readiness and other profile workflows are separate.

PR #187 is merged with GitHub Build Check passed, but its support report/CSV
published retest and PR #186's partial-refund history-badge retest remain open.
No client, job, payment, ticket or notification was changed during this repair.
