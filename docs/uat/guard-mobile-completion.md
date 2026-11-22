# Guard mobile completion acceptance

The mobile dashboard previously lost today's in-progress shifts from its home card, then described a checked-out shift as awaiting approval without submitting any completion request. Guards had no mobile action to advance it.

The repair keeps today's confirmed and in-progress assignments visible and provides Request Completion on both Home and Shifts after check-out. It uses the existing authenticated request-job-completion endpoint; server attendance, funding, issue and ownership checks remain authoritative. The client prevents duplicate clicks, validates the acknowledgement/request ID, checks account identity before and after, retires unmounted/account-changed responses and reports uncertainty without claiming approval.

Validation: 21 focused mobile/profile/saved-job regressions passed. The final four new completion tests also passed after the final type adjustment. Repository TypeScript and focused ESLint passed without warnings; hosted product TypeScript and private test-site build passed.

The isolated browser retest uses the actual mobile screen and shared helper with only sandbox transport/framing adaptations. Funding is a labelled simulated fixture, so this is guard workflow acceptance, not provider payment acceptance. The test covers genuine desktop check-in, mobile check-out and mobile completion submission against deployed handlers.

