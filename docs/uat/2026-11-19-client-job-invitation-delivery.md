# Advanced Matching invitation creation and delivery (C04)

Advanced Matching previously inserted a Job Invites record directly in the
browser. There was no corresponding bell/email delivery path, and the insert
policy checked the client's ID without checking the selected job's owner.

The client now calls `create_client_job_invite` and reports only a confirmed new
or existing invitation. It never claims an email was delivered. Failed/unconfirmed
requests retain the selected job for Retry. A ref blocks rapid double submission;
captured job IDs, auth checks and request/unmount guards reject stale UI results.
Inviting a guard still does not bookmark that guard, apply, select, book or pay.

## Atomic creation and authorization

Migration `20261119231802_client_job_invitation_delivery.sql` is applied. The
CLI-created local filename was aligned with the authoritative hosted migration
history version; its SQL is the tested/deployed migration.

The browser-callable RPC is SECURITY INVOKER and keeps RLS in force. It derives
the active client from auth.uid(), checks closure and locks the owned job before
checking/creating the unique job/guard pair. Replays return the existing invitation
without additional alerts. Two trigger-only functions use an empty search_path
and have browser EXECUTE revoked; their narrow elevation resolves private guard
eligibility/auth recipients and writes the private delivery queue.

Before insertion, the trigger verifies exact client/job ownership, active/open
recruitment state, no deleted/draft/funded/processing/paid/refunded work, future UK
start time, no expiry, and an active approved/verified guard with a recorded admin
reviewer and current recorded SIA details. Closed client/guard accounts are
rejected. Only pending new invitations are accepted, with a server timestamp and
a maximum 2,000-character message. Direct inserts receive the same validation.

The inbox record, eligible bell notification and email queue entry commit in one
transaction. A queue/notification failure rolls back creation. Bell alerts use the
guard's auth user ID, category jobs and `/guard/job-invites`; job_matches and
in_app_alerts preferences are respected. No email address/user identity is exposed
in the client catalogue or RPC response. Missing auth email does not prevent an
inbox invitation and does not invent an email delivery.

Recipient/job/client/message/creation bindings are immutable. Authenticated
DELETE is revoked and the old client-delete policy removed, preventing a
delete/recreate cycle from bypassing replay protection. Anonymous mutation grants
are removed. Guard response updates and the existing authoritative atomic
accept/application path are retained; this migration does not replace them.

## Durable email worker

`send-job-invite-email` is ACTIVE v1 with verify_jwt=true and additionally requires
the service worker key. `process-email-queue` is ACTIVE v39; its pre-existing
verify_jwt=false setting and service-key/worker-token authorization are preserved.
The v38 deployed worker source was compared with repository base before updating.
The sender was deployed first, then the worker, then the migration.

The worker delegates only invitation/queue IDs. The sender requires a matching
claimed processing queue row, re-reads pending invitation, owned job, guard,
client, closure and preferences, and resolves the current **verified auth email**.
Caller-supplied recipients, subject/HTML and queue recipient fields cannot choose
the destination. Closed/unavailable/started/funded work, non-pending invitations,
opt-outs and non-instant email preferences suppress immediate mail. Daily/weekly
summary delivery remains the separate existing digest system, not a claim made
by this immediate sender. The inbox remains the authoritative invitation.

Only non-sensitive job/company/city/name text is included, escaped for HTML, with
a fixed QuickGuard sign-in link. Private invitation message text, SIA details and
contacts are not emailed. The copy says an invitation is not a booking or guarantee
of work. Resend calls have a 10-second timeout and stable `job-invite:<invite-id>`
idempotency key. Provider acceptance ID is saved on the private queue before
completion; a completion replay reuses it instead of sending again. Resend's own
idempotency window is 24 hours: this is not an unlimited exactly-once transport
guarantee if acceptance and its database recording both fail. Reconciliation and
controlled failure testing remain part of acceptance.

The worker completes only confirmed provider acceptance, parks confirmed
suppression separately, and retries unconfirmed/provider/DB failures. Suppressed
mail is never counted as sent/delivered. Provider acceptance is not mailbox
delivery, and no delivery success is inferred from queue insertion.

## Validation and release

- All **685 repository unit tests** pass. After the final funded-job boundary,
  all **28 focused** catalogue/invitation/PostgreSQL/sender/worker tests pass.
- TypeScript, admin/financial checks, full lint and final production build pass.
  Lint retains only eight existing blog-image warnings.
- Actual migration fixtures cover owned/foreign/anonymous/closed/inactive actors,
  private recipient resolution, guard inbox ownership, unavailable work/guards,
  duplicate replay, immutable bindings, forbidden delete/recreate, preference and
  missing-email cases, rollback on queue failure and repeated migration install.
- Actual component/sender/worker tests cover rapid clicks, response confirmation,
  auth change, stale/unmounted results, escaped HTML, current verified recipient,
  opt-outs, provider/DB errors, cached acceptance and suppression/completion Retry.
- Production metadata checks confirm RLS enabled, invoker RPC, authenticated
  execution allowed, anonymous/trigger-function execution denied and authenticated
  DELETE denied. Invitations, invitation queue rows and invitation bell records
  remain **0 before and after deployment**. No backfill or authorized worker/provider-send test was performed. Automatic review rejected live email-function POST probes because a queue worker might send pending mail; no HTTP result is claimed. Read-only metadata and local authorization tests were used instead.

After green CI/review, merge the PR, import latest main into Readdy and publish.
Backend changes are already installed; no dependency, secret or template setup is
needed. Then run controlled acceptance with explicitly labelled synthetic client,
future open job and approved guard: create/replay, guard Job Invites, bell link,
provider acceptance/mailbox delivery, opt-outs and failures/Retry. Do not use a
real guard or advertise a real shift for that test. Existing guard invitation
accept/application and populated/realtime/error journeys retain separate UAT.
No production invitation, bell, email, application, job, booking or payment was
created by this repair. Public launch remains on hold for the remaining inventory.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
