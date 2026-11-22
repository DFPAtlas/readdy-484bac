# Admin rejection email repair — 22 November 2026

Rejecting a guard previously saved the decision without calling the rejection email sender, while the admin UI claimed an email had been sent.

The rejection endpoint now requests the existing `guard_rejection` sender only after the guard update succeeds. It passes the stored guard ID, trimmed reason and a fixed set of review-section labels. Blank, non-text and overlong reasons are rejected before any mutation. Existing authentication, MFA and sender duplicate protection remain in place.

The response reports `notification_status`: `accepted` requires the sender to return success with a provider message ID; `already_sent` reflects the sender's duplicate prevention; `failed` covers provider/network failures and malformed or unconfirmed responses. Email failure leaves the rejection intact and the UI tells the administrator to check the email log rather than repeat the rejection. Provider acceptance does not prove inbox delivery.

Validation: all 998 regression tests passed; repository and admin TypeScript checks passed; isolated strict compilation of the Edge Function had zero diagnostics; lint passed with nine existing warnings; the production build generated all 214 pages. The first build attempt was killed by the workspace while running alongside the regression suite; the isolated build passed.

Automated regression coverage exercises successful sends, duplicate prevention, HTTP and network errors, malformed responses, invalid reasons, failed writes, and frontend feedback. Live approval/rejection email UAT uses a separately authorised synthetic account and controlled inbox; a passing automated test does not prove inbox delivery. No test email or guard approval is performed by these automated tests.
