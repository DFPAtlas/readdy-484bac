# Public job query and build boundaries

26 November 2026. Repository repair based on merged PR #290, commit
`ec33d288fa34b12f728241440970941aa882ebdb`. This change does not deploy a database migration or activate scheduled publishing.

## Confirmed causes

Production logs were inspected read-only. PostgREST SQLSTATE 42501 queries matched anonymous Node requests to `jobs?select=id` and `jobs?select=id&status=eq.open&limit=200`. Six private job routes called these queries from `generateStaticParams`, where no user's browser session exists. Their fallback shells already existed and did not require those private reads.

SQLSTATE 22P02 matched Node requests to `get_public_jobs`, filtering UUID IDs with literal `1`, `2` and `3` during metadata generation. These are the existing static-export fallback route values, not actual job UUIDs.

The browser-side permission errors matched five homepage count requests from the Readdy preview: guards, clients, completed jobs, all assignments and completed assignments. These requests tried to read private tables anonymously. Denying them is correct; granting public access would expose the wrong data.

## Repair

- All six private static generators retain their existing three compatibility shells but no longer create a database client or enumerate private job IDs. Actual job IDs still reach their existing client component unchanged; authenticated reads and owner checks are preserved.
- Public metadata and the public job client validate the canonical hexadecimal UUID form before any job lookup. Invalid IDs produce the existing generic metadata/not-found state; blank IDs retain the existing jobs-list redirect. Public static generation filters malformed returned IDs. Real public job metadata, listing reads and canonical URLs remain intact.
- Homepage statistics use the existing `app.qg_launch_public_stats` table, selecting only `key,value`, explicitly filtering `is_public=true` and four named metrics below. No table grants, RLS policies, service key, new aggregate function or financial data access are added.

| Published key | Existing homepage metric | Accepted value |
| --- | --- | --- |
| total_guard_profiles | Guard profiles | Nonnegative safe integer |
| total_completed_jobs | Jobs Completed | Nonnegative safe integer |
| total_active_clients | Active Clients | Nonnegative safe integer |
| completed_assignment_rate | Completed assignment rate | Finite percentage from 0 through 100 |

These are explicitly published, curated values, not automatically calculated private-table counts. No statistics are seeded or published by this repair. Existing launch-interest/token counters are not relabelled as platform usage. Missing, malformed or failed optional metrics remain null/hidden, and the existing minimum display threshold of 50 is retained. Unmounted responses cannot update the page.

Native production read-only role validation confirmed anonymous SELECT on the public metrics table succeeds, with zero published rows currently. Anonymous SELECT on jobs, guards, clients and assignments remains denied. The statistics section therefore remains absent until supported values are explicitly published through the existing administration process. No claim of live usage totals is introduced.

## Verification and release boundary

The merged Readdy v2510 base also removed the price component's billing-cycle prop while the existing upgrade page still supplied it, causing the repository TypeScript check and build to fail. The component now defaults to the current monthly public presentation and accepts the upgrade page's explicit annual cycle using the existing authoritative price helper. No public-page annual toggle is restored, and no checkout fee, price ID or billing calculation changes. The component still rejects unavailable annual prices.

Existing tests were brought into line with that merged presentation: public/print monthly pricing, the upgrade page's annual option and the current 8-hour £18/hour example (£144 gross). The cancellation harness resolves and renders the actual extracted BookingPolicySummary rather than failing its relative import; cancellation assertions are retained. The pricing browser smoke keeps monthly public-page checks and adds an authenticated client upgrade annual-display check. These repairs address actual baseline compilation and harness failures rather than suppressing them.

Nine new execution regressions cover the six real private generators and forwarded runtime IDs; invalid/valid public metadata and route IDs; public static IDs; the actual public job component; scoped public metrics, validation/failure behavior, display thresholds and unmount retirement. The animation observer also reattaches after the optional metrics load, so the late-inserted statistics section can become visible; both an execution regression and the browser's computed-opacity assertion cover this. Fixtures do not use production credentials or provider traffic.

The Build Check additionally runs `scripts/uat/public-job-query-browser-smoke.cjs` on built pages at 1440px and 390px. It verifies published/absent/failed metrics, forbids private count requests and invalid UUID lookups, and checks a valid UUID still reaches the public listing API. All API responses are synthetic and third-party traffic is blocked. The pre-existing full browser suite remains enabled.

Current-head PR checks record complete suite, lint, typing, offline build and browser results. Local build uses the loopback placeholder Supabase settings. Local Chromium is unavailable, so no local browser pass is claimed. Existing lint warnings are not suppressed.

Merge, import the exact reviewed changes into Readdy and publish before claiming the live errors resolved. Then inspect a new build and guest-page request window: no anonymous private static-ID enumeration, no numeric-ID metadata requests, and no homepage private count requests. Do not weaken permissions to remove log entries. Other error signatures need their own diagnosis.

The production scheduler installed by the separately approved PR #290 migration remains paused. This repair changes no production jobs, queues, subscriptions, payments, entitlements, privileges or cron state. Activation and the remaining integrated/operational/legal launch gates remain separate decisions.
