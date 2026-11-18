# Replacement request read recovery

## Problem and repair

The client notification replacement panel ignored database read errors and displayed failures as an empty list. Its job-detail status tracker had the same problem and could disappear entirely after a failed initial read.

Both views now inspect returned errors, catch thrown reads and require an array before accepting a snapshot. A failed load shows an accessible error with Retry instead of claiming no requests or hiding the tracker. Refreshes retain the last known snapshot internally, but status summaries are hidden until a successful read confirms the latest state. A successful empty array keeps each view's existing empty behavior.

Retries show the loading state and use the current client/job context. The panel retains its client filter and job-title/location join. The tracker retains both client and job filters. Both retain creation ordering and their existing app-schema realtime subscriptions. Missing context produces an error without an unscoped query or subscription.

Request sequencing and cleanup reject late successes, late failures and retired realtime callbacks. Retry handlers also verify the current client/job identity before invoking a stored loader. Changing the client clears old rows and expanded panel details; changing jobs also invalidates the old tracker load. Unmount removes subscriptions and disables pending callbacks.

## Validation

Twelve new tests cover both views: returned/thrown/malformed failures and retry; owner/job query and subscription scopes; successful emptiness versus missing context; failed realtime refresh with recovery; superseded successes/failures; changed clients and job-only changes; retired retries; unmounts; and rendered accessible error states without false empty/status summaries.

The focused set includes the five existing booking/messaging sequencing tests and five company-contact tests (22 total). This branch includes the same contact-wrapper test-loader correction as PRs #168/#169 because its base contains the newer Readdy contact wrapper. No contact-page application code is changed.

Full-suite, TypeScript, repository lint, admin/financial and production-build results are recorded in the PR description. Automated failure cases use mocks. Production build validation uses the established loopback Supabase placeholder. No replacement request, support ticket, notification or email is created or changed by these checks.

## Deployment and signed-in checks

After GitHub checks pass and merge, import latest main into Readdy and publish. No database migration or Edge Function deployment is required.

Open client notifications and a job's replacement tracker. Confirm existing requests and status summaries match saved data, including the job links and expanded details. With a mocked failed read, expect a visible error and Retry in both views; the tracker must remain visible as an error. Retry a successful read and confirm recovery. Switch jobs during a delayed request and confirm the final job's data wins. Live signed-in checks remain required after publication.
