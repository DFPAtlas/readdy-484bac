# Client notification history completeness

The full client Notifications page previously requested only the newest 100 matching rows, displayed their length as the total, and provided no way to reach older records. “Mark All Read” also referred only to those loaded rows.

The inbox now reads every matching owned record in ranges of up to 100, using exact counts and deterministic `created_at`/`id` ordering. Every range repeats the same owner, category, priority, status, search and date filters. Smaller server response caps advance by the actual number returned. A missing/changed count, duplicate or foreign ID, premature empty page, failed response or retired request rejects the incomplete load. Authentication is rechecked between pages; obsolete filters and unmounted/account-switched inboxes stop fetching further ranges.

The page renders 25 notifications at a time. Matching/unread/priority counts and sorting cover the complete loaded filter result; previous/next controls show the current range and total pages. Filter/sort changes reset the page and selection. A shrinking result clamps the current page. “Mark Page Read” and bulk selection apply only to displayed rows, and hidden-page IDs are rejected by the page action handler. Pagination is locked during a save; existing exact acknowledgement and partial-write handling remain in place. The dashboard dropdown still intentionally shows its latest 20 records.

## Automated evidence

- All 405 synthetic records are loaded and reachable across 17 displayed pages, including five records on the last page.
- Empty, exact-size and smaller server-capped responses retain complete totals.
- Later-page failures, changed/missing totals, duplicate/foreign rows and premature endings cannot become a partial or empty success; Retry restores the complete inbox.
- Authentication and request retirement stop paging without exposing earlier rows.
- Page-only reads, bulk selection, hidden-ID rejection, locked navigation, filter/sort reset and deletion of the final page are exercised through the actual page logic.
- Rendered cards, range/total, disabled navigation, page selection count and “Mark Page Read” wording are checked.
- The 405-record regression fails against the previous helper's 100-row limit.
- Three existing document/payment test loaders now resolve the browser helper imports introduced on latest main. They exercise the actual browser rules, while endpoint tests continue to use their separate server rules; no product document or payment behavior is changed here.

## Published acceptance

With an isolated test client and explicitly approved synthetic notifications, verify a history larger than 100 records, both ends of pagination, counts after filters/search/sort, a later-page Retry, and read/unread/delete on the displayed page. Verify another client cannot view or act on those IDs. Do not create or delete production notifications merely to populate this test.

No migration, delivery action or production notification mutation is required by this repair. Multiple HTTP ranges are not a transactional database snapshot: detectable count drift/duplicates fail and require Retry; arbitrary concurrent content changes cannot all be detected. Large-history performance and live controlled mutations remain acceptance work. Category normalization and end-to-end delivery retain separate coverage.
