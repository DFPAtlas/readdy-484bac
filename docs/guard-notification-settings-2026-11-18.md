# Guard notification preference recovery

## Problem and repair

The guard preferences page ignored returned read errors and displayed default enabled toggles when settings could not be read. It also combined two writes into one generic success/failure message: notification preferences could be saved even when the subsequent guard-filter update failed.

The page now commits a complete verified-owner snapshot only after both required reads succeed. A failed or malformed read shows an alert and retry screen instead of editable defaults. Defaults apply only after a successful read confirms that the notification-preferences row is absent. Existing false values and numeric zero values are preserved. An authentication read error is shown as a load failure; only a confirmed signed-out result redirects to login.

Saving requires a successfully loaded snapshot and re-verifies the current account. The notification upsert explicitly uses the existing user_id conflict key, and both writes must return the expected owner's row before complete success is shown. If alert/email settings are saved but job-match filters are unconfirmed, the message identifies that partial result. The existing two-write operation remains nontransactional; this repair does not introduce automatic rollback or guarantee whether an unconfirmed network write committed.

Request sequencing, page lifetimes and a synchronous save lock prevent stale updates, state writes after unmount and overlapping submissions. Controls are disabled during a save. Database permissions, notification delivery workers, schedules and preference defaults are unchanged. No email or live notification is sent by the tests.

## Validation

Eight targeted tests pass, covering owner scopes and opt-outs; confirmed absence versus read errors; returned/thrown/empty/wrong-owner saves; partial results; changed accounts and invalid filters; retry and late reads; repeated/unmounted saves; and the rendered error/retry screen.

TypeScript, targeted lint, the admin/financial type gate and the complete production build passed (212 static pages; only the eight existing blog image warnings). All 432 local unit tests passed with concurrency limited to two. GitHub CI remains the final merge gate. Build validation uses the dummy loopback Supabase configuration established in PR #164, rather than the production endpoint.

## Deployment and browser checks

After GitHub checks pass and the PR is merged, import latest main into Readdy and publish. No SQL migration or Edge Function deployment is needed.

For signed-in UAT, open guard notification preferences and verify that existing toggles, email frequency and matching filters match the account's saved settings. Save a deliberate change and reload to confirm it persists. With a mocked failed read, expect an error and retry screen with no editable defaults. With only the guard update failing, expect a partial-save warning rather than a claim that everything failed or succeeded. Failure paths are covered with mocks so no live preferences are changed during automated testing.
