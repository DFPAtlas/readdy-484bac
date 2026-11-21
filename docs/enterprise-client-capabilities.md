# Enterprise client capability release

This release completes the agreed contract, CSV import and report PDF workflows,
adds priority routing with the confirmed service hours, and makes arranged API
integration requests available in the client portal. Earlier accepted repairs
remain closed.

## Product behavior

- **Company contracts:** Profile → Documents → Company contract terms. Upload
  UTF-8 plain text (.txt), or paste up to 60,000 characters, and save a named
  version as the default. New publications, including published drafts and bulk
  posts, receive an immutable snapshot. Changing/stopping the default affects
  future publications only. The existing private PDF/Word document store remains
  available separately. Guards review the job snapshot and explicitly accept it
  from Job Details or Apply. Assignment is blocked in the database until the
  exact snapshot is accepted. Company owners can read guard acceptance names and
  timestamps on the job; a guard sees only their own acceptance. Existing jobs are not retroactively modified.
- **Bulk CSV:** Download the template, import up to 100 rows / 1MB, review the
  existing grid and shared settings, then choose Post All. The import is local
  and creates no job. Quoted fields, escaped quotes, CRLF and multiline text are
  supported. Headers, dates, times, numeric bounds and security types are
  validated before changing the grid. Existing entered rows are preserved.
- **PDF:** Job History, Attendance, Compliance, Finance and Support reports offer
  a real PDF download for the currently filtered rows. Long rows paginate and
  column headings repeat. CSV and recorded financial totals are unchanged.
- **Priority support:** The database derives service tier from the client's
  active owned entitlement when creating a ticket. A browser cannot forge it.
  The QuickGuard admin queue ranks severity first, then priority-plan tickets,
  then oldest first. The central support bridge carries the tier and promotes
  priority requests while preserving urgent severity. Human hours are
  Monday–Friday 08:00–17:00 Europe/London, including UK daylight-saving changes;
  AI assistance is available 24/7. No response-time SLA is promised.
- **Arranged API access:** API Access in the client portal accepts integration
  requirements and shows owned support-request status. The normal idempotent
  support ticket path and central bridge handle the request. Support confirms
  scope and provisions credentials separately. This release creates no API
  secrets and does not add self-service keys or claim an integration is connected
  merely because its request was saved.

The designated QA client's Enterprise entitlement/quota alignment is an
operational test-account change, recorded separately. It does not change Stripe
subscriptions, price IDs or payment logic. A provider entitlement refresh can
reconcile the test override back to its billed plan; check test configuration
before a later Enterprise UAT run.

## Deploy after merge

1. Apply `20261121175815_enterprise_client_contracts_and_priority.sql` to the
   intended database. It depends on the already deployed profile-role helper.
   Verify the caller-only RPC grants, private tables/RLS and contract triggers.
2. Deploy `dfp-support-ticket-bridge` with its relative dependencies unchanged.
3. Publish the frontend from the merged source.
4. Verify the new controls using labelled synthetic fixtures. Do not publish real
   adverts, charge money or grant access as part of a read-only smoke.

## Acceptance and boundaries

SQL regressions cover profile-only ownership, denied foreign/closed identities,
private-table ACLs, immutable versions, draft publication, unchanged historical
snapshots, acceptance hashes, assignment blocking, duplicate retries, stale
changes, silent-write rollback and entitlement-derived support tiers. UI tests
exercise explicit consent, account retirement, frozen retries, local CSV import
and honest central-routing status. Real PDF rendering tests cover pagination and
output bytes. The existing financial, ownership, quota and messaging suites must
remain green.

A live legal acceptance must be performed by the actual reviewing guard; do not
accept another person's terms automatically during a production smoke. A
support-provisioned integration still requires its customer's requirements and
an agreed scope. Human support delivery follows the staffed operating policy;
software routing alone is not proof of an individual response time.
