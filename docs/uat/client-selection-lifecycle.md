# Client selection lifecycle repair — 28 November 2026

The read-only live smoke found a signed-in test client with Enterprise access and Starter billing, a working posting form, and one existing draft without applicants. It did not prove applicant selection. No live job, application, notification or payment was created.

Inspection and PostgreSQL regressions then reproduced a separate server defect: `select_job_guards` could move a draft/cancelled/closed job back to `awaiting_payment`, or revive a withdrawn/rejected application. The job payment guard alone did not prevent these transitions. Thirteen new negative scenarios failed against the previous function; the valid pricing/ownership/retry cases passed.

The replacement function accepts only recruiting/provisional job states and rejects the draft flag. It locks and checks each application before changing it; withdrawn, declined, rejected, completed, null or unknown states fail closed. Existing owner checks, recorded guard approval, SIA/licence checks, server pricing and provisional payment states remain in place. A rejected batch rolls back every selection. The applicant screen provides specific refresh/reselection messages for the two new denials.

## Verification

- 21 new database test assertions (including parent test results) pass. The focused selection, scheduled-hours, application-expiry and free-access run passed 43 assertions.
- Repository TypeScript and admin/financial type gates passed; focused lint and whitespace checks passed.
- Applied only `client_selection_lifecycle` to the existing isolated `alfwwggavmyerjyqumuo` branch.
- `scripts/uat/client-selection-rollback.sql` passed seven authenticated-role native checks: draft rejection, cancelled rejection, withdrawn rejection, eligible provisional selection, ignored browser amounts, one assignment on retry and unpaid job state. It uses the exact existing synthetic sandbox client/guard/job and a final rollback. It does not call checkout or browser push.
- Independent before/after digests matched for jobs, guards, clients, applications, assignments, notifications and audit rows. Cron remains disabled. Anonymous execution is denied and authenticated execution remains allowed.
- The first native run encountered the legacy fixture's deleted flag (`job_not_owned`); that entire run rolled back. The probe now restores `is_deleted=false` only inside its rollback transaction. The second run passed all seven checks.

No production migration, Edge Function deployment, website publication, PR merge or provider call was performed. This is native database acceptance, not a browser selection/sign-in/payment acceptance claim. Deploy the reviewed migration through the normal release path before importing/publishing the frontend messages, then complete the isolated browser selection check before checkout. Do not publish a test advert or use a real applicant to manufacture that evidence.
