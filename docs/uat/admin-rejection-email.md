# Admin guard creation and rejection repairs — 22 November 2026

The live Add Guard test failed with `Unauthorized` at 11:33:52 UTC. The frontend sent the anonymous API key as its bearer credential; the deployed creation service correctly rejected it. A database read confirmed no test Auth user was created. No approval/rejection email was sent by this test.

Add Guard now uses the signed-in admin session, includes a stable idempotency key for retries with unchanged input, and blocks overlapping submissions. It requires an acknowledged guard ID, matching email and `pending_review` status before clearing the form. The success panel matches the current service contract; obsolete password and Auto-Approve controls are removed. The repository creation function is synchronised with deployed version 38 to preserve its existing authentication, MFA, allowed-field validation, uploads and rollback behavior, plus an explicit null-user guard required by strict compilation. Creation still requires an active authorised admin with MFA and leaves the new guard pending review.

Rejecting a guard previously saved the decision without calling the rejection email sender, while the admin UI claimed an email had been sent.

The rejection endpoint now requests the existing `guard_rejection` sender only after the guard update succeeds. It passes the stored guard ID, trimmed reason and a fixed set of review-section labels. Blank, non-text and overlong reasons are rejected before any mutation. Existing authentication, MFA and sender duplicate protection remain in place.

The response reports `notification_status`: `accepted` requires the sender to return success with a provider message ID; `already_sent` reflects the sender's duplicate prevention; `failed` covers provider/network failures and malformed or unconfirmed responses. Email failure leaves the rejection intact and the UI tells the administrator to check the email log rather than repeat the rejection. Provider acceptance does not prove inbox delivery.

The final creation/rejection revision passed 1,002 regression tests, followed by five focused creation tests including a subsequently added backend authentication/MFA/submission-key case. Repository and admin TypeScript checks passed; strict compilation of both Edge functions had zero diagnostics; lint passed with nine existing warnings; and the final production build generated all 214 pages. The first rejection-only build attempt was killed by the workspace while running alongside the regression suite; both isolated builds passed.

PR220 was merged and published. Its updated form was verified live. Follow-up service repairs are deployed as `create-guard-from-admin` v45 and `send-guard-approval-email` v55, with JWT verification and existing admin/MFA gates retained. The [follow-up UAT record](post-pr220-guard-provisioning.md) describes the trigger, rollback and email fixes found during the live run.

Live account creation and rejection passed, including persistence after reload and independently confirmed delivery of the rejection email to the authorised test inbox. The synthetic guard remains inactive, unverified and test-only. Successful approval UAT is still pending a suitable documented test fixture. Automated tests never send real emails or approve guards.
