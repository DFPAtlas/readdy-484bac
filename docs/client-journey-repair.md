# Client journey repair

The client dashboard previously showed confirmed bookings as Posted, omitted Confirmed from job filters, and calculated payments differently from Payment Centre. The job wizard hid the server's specific validation failures, and its map preview still depended on an unavailable build-time key.

## Changes

- Shared booking next actions and payment labels; permanent query-based pages for newly created jobs.
- Dashboard next-step panel across the fetched client jobs, confirmed-booking shortcut, clickable pipeline, and positive-count notifications.
- Confirmed filter, independent job-tab counts, persisted client-specific filters and scroll position.
- Job-specific payment history, refund request progress and direct booking links.
- Gross collected payments include full and partial refunds; completed refunds are shown separately and subtracted for net spend. Failed/pending attempts are excluded from collected totals.
- Wizard title/description validation matches the server, errors appear alongside fields and in a navigable summary, first invalid fields receive focus, and user input is retained.
- Maps preview uses the existing authenticated maps-embed-config function instead of a frontend environment key. Loading, retry and an external map link are available. Admin previews and readiness use the same configuration.
- Guard dashboard uses the same next-step heading, permanent shift details links and mobile payment shortcut.

## Verification

- Unit/regression suite covers booking navigation, funded/cancelled payment guards, full/partial refund accounting, frontend validation, and rendered confirmed/paid dashboard cards, as well as existing cancellation and financial RPC tests.
- Production build and admin/financial TypeScript gate must pass before merge.
- Full repository TypeScript errors are compared with main; unrelated existing debt remains.

## Publish validation

These steps require the merged frontend to be pulled and published in Readdy. They have not been represented as completed live tests:

1. Client: open Confirmed Bookings, then payment details; return and confirm filters/position are retained.
2. New job: open guard details and apply; return as client and review applicants.
3. Confirm that Maps renders on quickguard.uk; authenticated key retrieval alone does not verify Google's API/referrer restrictions.
4. Retest the existing £92 sandbox cancellation and refund through admin, confirming saved cancellation/refund records and Stripe state. Do not create another payment for that funded job.
5. Check the dashboard and Payment Centre agree after refund. Before the final £92 refund, the current test account has £276 gross, £112 refunded and £164 remaining.
6. Repeat navigation on mobile and confirm primary buttons are easy to reach.

The existing maps function is already deployed. Its source is now tracked in this branch, with an explicit origin rejection matching its existing origin policy. No new function deployment, live refund, merge or frontend publication is performed by this change.
