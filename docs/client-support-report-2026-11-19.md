# Support & Disputes reporting — C09

The report queried only app.complaints, so the existing client's three support
tickets disappeared from All Time reporting. It also used complaint identifiers
and severity fields for every record, labelled complaint counts as disputes,
omitted awaiting-client status and computed counters independently of filters.

## Changes

- Load three separately labelled sources: non-deleted owned support tickets,
  complaints filed by the authenticated client user, and owned job disputes.
  Each source pages all rows with stable creation/ID ordering. Retained records
  do not disappear because their related job is deleted or terminal.
- Use deployed column names, including support_tickets.related_job_id and
  ticket_reference. Select only the report fields; admin notes, provider payment
  identifiers, private guard/contact data and evidence links are not read.
- Preserve source identity even when record IDs or related issues overlap. The
  report explains that counts represent records, not deduplicated incidents.
  Tickets, complaints and job disputes can be filtered independently.
- Period filtering uses inclusive UK record-creation dates. Source, status and
  priority/severity filters feed one row set for counters, cards/table and CSV.
  Awaiting-client, closed, critical severity and resolved dispute outcomes are
  supported. Active urgent/critical counts exclude resolved/closed history.
- Report overview separates Open Support Tickets from Active Job Disputes.
  The report-card count follows the selected period. The finance card also uses
  its already-filtered subscription rows, aligning that count with its period.
- Show readable references, source, subject, linked-job navigation, recorded
  priority/status and UK creation/resolution times. The Support Centre link opens
  the existing support page; no invented ticket-detail deep link is introduced.
- CSV follows the exact visible filters, with source, record/reference/job IDs,
  description and resolution fields, complete UTF-8/quoted multiline content,
  UTC timestamps and spreadsheet-formula protection. It counts exported records.
- Source errors or malformed rows reject the report load and use the existing
  page Retry state, rather than a successful zero report. Existing page request
  retirement prevents superseded/closed-screen results replacing current data.

## Evidence and acceptance

The deployed schema and authenticated-role equivalent projections were checked
read-only. The existing test client has three visible tickets: two open and one
awaiting_client; complaints and disputes are both empty. All Time must therefore
show three support records, with two Open and one Awaiting Client Reply. The
Last 30 Days preset can correctly show zero because the tickets were created in
October; compare the same period in both views.

Focused report/finance tests cover the live-like three-ticket case, every owned
source, deletion/foreign exclusions, retained jobs, cross-source ID collisions,
pagination, schema validation, UK/BST date boundaries, priority/status/resolution
filters, actual page error/Retry handling, cards/table rendering and actual CSV
download bytes. CSV is parsed back into twelve columns to check quotes, multiline
text, formula protection and exact filtered membership. All 625 repository unit
tests and 22 focused support/finance checks pass. Repository typecheck and admin
checks pass; lint has zero errors and eight existing blog-image warnings. The
local production build and GitHub Build Check must pass before release; their
final results are recorded in the PR.

After checks/review and merge, import latest main into Readdy and publish. No
migration or function deployment is required. Retest All Time count/reference/
source/status/priority, filters, linked jobs, the Support Centre link, card/table
parity and downloaded CSV contents. Positive complaint/dispute data and forced
live Retry remain controlled acceptance; no live ticket or dispute was created.
C09 remains open until the published signed-in retest passes.

PR #186 has merged and its GitHub build passed; its partial-refund Job History
badge still requires publication confirmation and a live retest. Other report
compliance/attendance, provider-document and export-category work keeps its
separate repair/acceptance scope. No record, payment or notification was changed.
