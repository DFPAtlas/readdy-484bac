# Job confirmation repair and native account acceptance

Date: 25 November 2026. Scope: isolated `qg-e2e-sandbox` (`alfwwggavmyerjyqumuo`) only. No production deployment or merge, live payment, outgoing email or retained fixture reactivation.

## Repair

The HTML job form supplies strings for hourly rate and guard count. `create-job` previously forwarded them unchanged; `send-job-posted-email` called `.toFixed()` on the rate and could fail after the job was successfully inserted. Posting also ignored non-success HTTP/JSON responses from that sender, so the client could miss the email failure.

Posting now forwards its already validated numeric values and adds the existing `email_failed` warning unless delivery is confirmed with a successful response and provider message ID. Job success, ID, idempotency, usage consumption and guard notification processing continue independently of confirmation-email failure. The sender also accepts numeric form strings safely, rejects invalid rate/count values and requires confirmed provider acceptance. Provider error details are not returned to the caller.

The service-only sender reads `app.settings.job_posted_email_delivery_mode` after authenticating the service caller. Missing means `send` for compatibility; `paused`, an unknown value or a failed configuration read cannot send. `dry_run` forwards `dry_run: true` to the existing template renderer; it never uses `is_test` (which would route a real email to the administrator). A successful preview returns `delivered: false` and no provider ID. The posting UI therefore still warns that confirmation was not delivered. This setting is private to the project and is not selected by caller input. Existing settings policies restrict changes to current MFA administrators; real ordinary-account read/write denial was verified.

No schema change or production setting is required. Sandbox mode was newly set to `dry_run` before deployment. Keep this safeguard in the sandbox. A later production deployment must inspect its own template/configuration and delivery mode rather than copying sandbox settings.

## Native Auth/API result

Run `qg-native-0b2370aae4974f9d` passed using three newly generated `.invalid` identities: two clients and one administrator. The fixtures were inserted after inspecting Auth/profile triggers and required constraints, with email already confirmed in fixture setup. Password login and TOTP verification then used the real Supabase Auth endpoints and issued real JWTs; no tokens or MFA assurance were forged. This is not signup or email-verification acceptance.

| Check | Result |
| --- | --- |
| Three password sign-ins and protected fixture provenance | Passed |
| Clients can read their native client profile | Passed |
| Ordinary client cannot read or update private delivery mode | Passed |
| Client and admin at AAL1 cannot read guest contacts | Passed |
| Forged role/MFA request fields cannot authorize removal | Passed |
| Foreign client cannot create a job under the owner's profile | Passed, 403 |
| Owner posts a job with string rate/count | Passed, one open job |
| Replaying the same submission returns the same job | Passed; usage remained one |
| Foreign client cannot complete the owner's enquiry | Passed, 404 |
| Wrong submission cannot complete an enquiry | Passed, 409 |
| Matching owned job completes the enquiry | Passed; late save returned 410 |
| Real TOTP enrollment/challenge/verification obtains AAL2 | Passed |
| Current MFA admin can read permitted columns and remove an enquiry | Passed |
| Receipt digest remains inaccessible even to admin browser | Passed, 403 |
| Original AAL1 token cannot perform admin removal | Passed, 403 |
| Admin removal cannot be undone by late contact save | Passed, 410 |

The sandbox contains no email templates. The missing confirmation template therefore remains a visible delivery failure; this run did not manufacture a template or treat an email warning as successful delivery. The posted job remained successful with `email_failed`. No template preview or outgoing email delivery is signed off. All guard candidates were checked before posting: no eligible guard had the test job's Security Guard licence. No guard accounts were reopened or altered.

## Cleanup and isolation evidence

All three temporary Auth identities, application profiles, sessions/MFA factors, client/admin records, the temporary job, and their usage records were removed with exact UUID, email and protected run-provenance checks. Guest contacts were removed through the real consent endpoints before database cleanup. Receipt-only withdrawal barriers and limiter metadata remain under their existing expiry rules; security audit history is preserved.

| Dataset | Before/after digest or count |
| --- | --- |
| Jobs | `8a8b25506eb8ec7084898c1f28fef7f2` |
| Subscriptions | `ded27d148e4e730c0fd9f53938eb2c5c` |
| Entitlements | `f84559605e00f25f891995d55c122104` |
| Email queue | `48f6c4c22294a2d9413673f52ada7bb9` |
| Email send log | 0 before and after |
| Active cron jobs | 0 before and after |
| Active guards / clients | 2 / 1 before and after; no baseline records changed |
| Remaining temporary Auth / profiles / job / contacts | 0 / 0 / 0 / 0 |

Digests are MD5 over ordered `to_jsonb(row)::text` for change detection, not security credentials. These are a fresh baseline using that serialization, not the older digest format in the phase-three receipt.

Sandbox deployments: `send-job-posted-email` version 57, JWT gateway verification retained true; `create-job` version 40, existing body authentication and false gateway setting retained. The deployed create-job baseline matched source except trailing whitespace. Sender baseline had one unused `RESEND_FROM_DOMAIN` variable; the repair retains its actual fixed branded sender behavior. Original deployed sources were captured before replacement. Renderer version 45 was not modified.

## Validation and rerun

Seven execution regressions load the actual sender and posting handlers. They cover numeric strings, malformed numbers, service authentication, paused/unknown/unreadable mode, preview-only behavior, unconfirmed provider responses, malformed JSON/network failures and successful job creation with honest warnings. All 1,351 repository tests passed. Repository/frontend checks, strict guest/sender Edge typing and a placeholder-backed production build passed. Lint has the same 12 existing warnings and no errors.

Native harness: `scripts/uat/guest-booking-auth-smoke.cjs`. Use only fresh synthetic fixture identities prepared in this sandbox, with inspected database triggers and protected `uat_run_id` / `uat_persona`. Before running, independently verify sandbox delivery mode is `dry_run`, all cron is inactive and there are no eligible Security Guard notification recipients. The script uses native Auth/API calls and does not provide isolation by itself if those preconditions are changed.

Set `QG_NATIVE_UAT_STATE` to a mode-0600 JSON file containing `project`, `run` (`qg-native-` plus 16 hex characters), a legacy public anonymous `publicKey`, and `accounts.owner`, `accounts.other`, `accounts.admin`, each with fresh `id`, `.invalid` `email`, and random `password`. The harness checks the public key role, verifies protected identity provenance after real sign-in, and stores session/receipt references privately for cleanup. It withdraws enquiries and logs out sessions in `finally`. An operator must remove only the exact run-tagged fixture database records afterwards and confirm the baseline. Do not commit or publish this private state file. The completed run's credentials were discarded after cleanup.

## Remaining launch gates

1. End-to-end browser acceptance with native signup, actual verification-email receipt and onboarding (the earlier CI browser journeys used synthetic APIs).
2. Confirm the active production job-posted template and its variable rendering, then perform an explicitly authorized delivery test; also verify correct wording for scheduled/draft jobs before that delivery sign-off.
3. Complete remaining Stripe test-mode booking/payment acceptance and the launch legal review. No live charge or payout is covered here.
4. Review/merge the guest feature before the stacked confirmation repair, enable and verify production guest retention as part of the authorized rollout, then run the complete final smoke test.
