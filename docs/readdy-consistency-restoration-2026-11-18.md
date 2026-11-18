# Restore consistency repairs lost during Readdy sync

Readdy v2363 restored older versions of the previously reviewed consistency changes. Comparing Git blobs against the pre-fix source and the approved PR #156 commit confirmed 45 exact reversions outside the pricing/company files handled by PRs #157 and #158. The footer had both a rollback and a new blog link, so only its support-hours correction was reapplied.

## Restored scope

- Remove unsupported city-directory/city statistics, five-star testimonials and volume/3x performance claims.
- Restore shared cancellation/refund guidance and the funded/confirmed cancellation modal eligibility. Backend ownership and financial safeguards remain authoritative.
- Describe rewards checkout redemption as planned across public pages, account screens and referral popup/share text.
- Restore factual founding recognition, configuration-unavailable handling and the aggregate availability RPC client. Preserve the closed legacy window and separate paid memberships.
- Correct metadata/structured descriptions, insurance wording, actual browser storage keys/transmission behaviour and human support hours.
- Remove the admin panel's obsolete fixed percentage plus separate Stripe-surcharge estimate.
- Restore the already-applied promotion migration file, its regression test and the original historical consistency report to Git history. Do not rerun the migration or allocate promotions to live accounts.

All automatically recovered files were verified to match the approved PR #156 content. The footer retains its new blog link and uses the shared support hours. The newer blog/admin-blog, launch, navigation, sitemap, package/dependency and PR #157 pricing files are unchanged. No files belonging to the pending PR #158 payout/company repair are modified, so these changes can merge independently.

## Runtime and validation

An anonymous read confirmed `app.get_guard_promotion_summary()` is still configured and its legacy launch window remains closed. The database migration is already installed; this PR restores its source record only. No live account, payment, promotion date or database configuration was changed.

Verification includes restored-file blob comparison, source-link comparison, full unit suite, TypeScript/ESLint, the admin/financial frontend gate and a production build. Final results are recorded in the PR. The original report remains at `docs/consistency-repairs-2026-11-17.md` as a historical record of PR #156.

After merge, import the latest main into Readdy before publishing. Publishing an older Readdy project snapshot can overwrite the reviewed GitHub repairs again. Rewards redemption and full company editing remain separate development work; PR #158 handles the existing company/payout flows.
