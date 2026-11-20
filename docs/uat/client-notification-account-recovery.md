# Client Notifications account recovery

The client Notifications page previously kept its inbox mounted when the authenticated account changed on the same route. The guard's loading/allowed values could remain unchanged, so the previous account's rows, company name, selection and pending operations could survive. Reads also accepted whichever user `getUser` returned without matching the account that requested the screen; delayed read/write results were not rechecked against current authentication.

The page now observes authentication directly and keys the entire inbox by the current user. A different user or sign-out retires the old inbox, including the replacement panel, subscriptions, selections and outstanding callbacks. The new inbox waits for the shared client guard to match that user. A token refresh for the same user preserves the inbox and its filters.

The read helper verifies the expected user before querying and rechecks authentication after profile and notification responses. Confirmed read/unread/delete responses are rechecked before they can be returned to either the full inbox or its dashboard dropdown consumer. Requests remain scoped to the original user and selected IDs. A write already received by the server can still complete for that original user; the screen must not claim that navigation cancels a server transaction.

## Automated verification

- Expected-owner mismatch issues no table query.
- Account changes, sign-out and authentication errors during profile/inbox reads discard old rows and missing-profile redirects.
- Late read/unread/delete acknowledgements cannot report success to another or signed-out account.
- Authentication events immediately change the rendered inbox key and wait for the matching guard; token refresh keeps the same key; callbacks after cleanup are ignored.
- Existing tests continue to cover failed reads/Retry, request ordering, duplicate-write locks, partial/zero-row confirmations, changed filters and unmounted pending reads/writes.
- Three new helper regressions fail against the pre-change helper and pass with the repair.

## Controlled published acceptance

Use two isolated client test accounts. With an inbox open, select a notification and change a filter, then switch accounts without a full page reload. Confirm no previous rows, company name, selection or replacement requests remain; the new account loads only its owned records. Repeat with a delayed read and a delayed mark-read response, and with sign-out. Refresh the token for the same account and confirm that filters do not reset. Test read/unread/delete confirmation and Retry only on explicitly approved synthetic notifications.

This repair requires no database migration or production notification mutation. Publication and this two-account live acceptance are separate from local checks. Notification delivery and category normalization retain their earlier coverage. The subsequent history-completeness repair is covered in [client-notification-history.md](client-notification-history.md).
