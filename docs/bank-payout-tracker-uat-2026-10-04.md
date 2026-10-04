# Bank payout tracker implementation and verification

Verified on 4 October 2026 using Stripe sandbox account `acct_1SYmuoIMkpwfAEDT` and Supabase project `vnywjfpkepjgclkbcmsj`.

## Behavior

Guard Earnings now has a separate Bank payouts panel with deposit amount, masked bank account, expected arrival, current Stripe status and failure explanation. A bank deposit can contain several job earnings; job transfers are not relabeled as bank deposits or assigned to a deposit without Stripe reconciliation evidence. Sandbox rows are marked Test.

The Connect webhook consumes `payout.created`, `payout.updated`, `payout.paid`, `payout.failed` and `payout.canceled`. It verifies the raw Stripe signature and environment, retrieves the current payout from the connected account, and writes the ledger, event receipt and status audit atomically. Duplicate deliveries do not create duplicate rows or audits. Processing failures return HTTP 500 for Stripe retries. A paid payout can subsequently fail; delayed pending/paid snapshots cannot undo a failure.

The authenticated refresh endpoint retrieves payouts for the caller's own guard account. Only active finance/super admins can supply a target guard ID. It also recovers historical payouts missed before webhook setup. Each refresh checks up to 1,000 recent Stripe payouts; the panel shows the latest 50 stored deposits and warns when older Stripe history remains. While open, the panel reloads stored webhook statuses every 30 seconds.

RLS permits guards to read only their own bank deposits, and active finance/super admins to read deposits. Browser roles cannot modify the ledger, execute its persistence RPC, or read event receipts/signing keys. Webhook signing keys are kept in a service-only RLS table and are absent from source and responses.

## Deployed backend

- Migration `20261004224222_guard_bank_payout_tracking.sql`, matching the recorded remote migration version.
- `stripe-bank-payout-webhook` v1 and `sync-guard-bank-payouts` v1. JWT gateway verification is disabled because the webhook validates Stripe signatures and sync validates caller JWTs using `auth.getUser` plus ownership checks.
- Connect sandbox endpoint `we_1UMy8gIMkpwfAEDTZfF5eWTm` points at `/functions/v1/stripe-bank-payout-webhook`. Existing platform payment webhooks were not changed.
- Temporary UAT runner disabled again: v27, HTTP 410 stub, gateway JWT verification enabled.

## Real sandbox evidence

Dedicated guard fixture `ebaa26fa-ccf6-4421-b68c-1b0469f9d288`, connected Custom sandbox account `acct_1UMvjsIl6yJPXXdQ`. No live funds were used. A separate £2 sandbox transfer `tr_1UMy97IMkpwfAEDT0dalR1Lg` funded the two £1 tests; it is not attributed to a production job.

| Check | Observed result |
| --- | --- |
| Success payout `po_1UMy99Il6yJPXXdQwitpVGIf` | £1, bank ending 2345, Stripe and app status `paid` |
| Failure payout `po_1UMy9AIl6yJPXXdQRVXF9ZGU` | £1, official failing test bank ending 1116, Stripe and app status `failed`, failure code `no_account` and bank explanation stored |
| Native Connect delivery | Nine genuine payout events recorded; Stripe reported zero pending webhooks for those events |
| Historical recovery | Authenticated refresh HTTP 200, synced 3; earlier £80 payout `po_1UMxv4Il6yJPXXdQZoNiyUOV` recovered as `paid` |
| Signed duplicate replay | Original failure payout-created event `evt_1UMy9BIl6yJPXXdQ5Quh0PNw` replayed twice: HTTP 200, `replayed:true`; ledger remained failed |
| Invalid signature | HTTP 400, no persistence |
| Caller ownership | Guard supplying a target guard ID denied HTTP 403; a different test user's direct ledger query returned zero rows |
| Browser privileges | Signing-key read and persistence RPC denied with PostgreSQL `42501` |
| Deduplication and audit | Three ledger rows; two paid status audits and one failed status audit after delivery/replay/sync |

## Local validation and limits

Automated checks cover lifecycle transitions, duplicate events/repeated sync, delayed events after failure, atomic rollback and retry after audit failure, account validation, RLS and write restrictions, connected-account Stripe reads, invalid signatures, retryable webhook failures, and panel rendering/currency conversion. Build passed. Repository-wide typecheck still has pre-existing frontend errors; none are reported in the new tracker component. The Supabase security advisor introduced no finding for the new bank tracker objects; unrelated existing project findings remain.

The backend is deployed. The frontend must be merged and published before the new panel appears on the hosted site; a browser check of that published panel remains after publication. Native bank cancellation has not been exercised against Stripe. This work does not resolve or prove the separate hosted Express onboarding CAPTCHA blocker, nor the remaining finance-admin/browser checks documented in the payment lifecycle UAT.

The configured Connect endpoint is sandbox only, consistent with the current test-mode payment system. A live-mode endpoint and its service-only live signing key must be configured and verified when the platform moves to live Stripe keys. Read-only refresh is recovery, not a payout initiation or retry: failed bank details still require correction through the existing Stripe account settings/support flow.

Stripe reference documentation: [Connect payouts](https://docs.stripe.com/connect/payouts-connected-accounts), [Connect testing](https://docs.stripe.com/connect/testing), [currency amounts](https://docs.stripe.com/currencies#special-cases), retrieved with Stripe CLI docs.
