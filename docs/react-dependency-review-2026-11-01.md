# React dependencies and accessibility — 1 November 2026

This repair batch removes 18 of 94 React dependency warnings and all three `jsx-a11y/role-supports-aria-props` warnings. Repository lint moves from 620 to 599 warnings with no errors. No dependency or accessibility rules are suppressed. This is not whole-site launch sign-off.

## Changes reviewed

- Admin jobs: remove the callback's implicit captured page and require explicit page arguments. The filter effect follows the stable fetch callback, so changing a page does not restart the filter effect and reset pagination.
- Client/guard payment centre: compute the current month inside each data load. Refreshing a long-lived screen after month rollover uses the current boundary without making the callback change every render.
- Digital Footprint admin notification bell: memoize the loader against the permission prop; the interval effect follows that callback and clears the old interval.
- Admin layout, session timeout, onboarding, profile wizard, notification settings, support loaders and public job detail: include the stable router/reset callbacks actually used by their effects. Existing cancellation flags and timer cleanups remain intact.
- Support drawers: synchronize against both ticket data and selected ticket, with existing status/time/priority guards preventing repeated state updates.
- Email template preview: move the stateless replacement helper outside the component and pass sample data explicitly to preserve memo invalidation.
- Guard-requirements form: put validation state on named radio groups, preserve native radio controls and descriptions, and render the previously missing error-description targets.

## Tests

Behavioral tests cover selected admin pages and filter resets without repeated fetches; client month rollover without remounting; rendered radio-group error associations; a single polling interval that reads current permissions; and support-drawer refreshes without update loops. Full test/build results are recorded in the PR description. No live publication, deployment, database mutation or application submission is performed.

## Remaining dependency warnings

The following 76 warnings still require individual review. They are not all confirmed runtime defects. In particular, inserting non-memoized functions or mutable objects into dependency arrays without reviewing the effect can introduce repeated requests or loops.

| Location | Warning |
|---|---|
| `app/admin/account/page.tsx:37` | React Hook useEffect has a missing dependency: 'loadAdmin'. Either include it or remove the dependency array. |
| `app/admin/client-monitoring/ClientMonitoringDetail.tsx:146` | React Hook useEffect has missing dependencies: 'fetchDocuments', 'fetchJobs', 'fetchMessages', 'fetchOverview', 'fetchPayments', and 'fetchTickets'. Either include them or remove the dependency array. |
| `app/admin/contact-submissions/AdminSubmissionsClient.tsx:121` | React Hook useCallback has an unnecessary dependency: 'search'. Either exclude it or remove the dependency array. |
| `app/admin/contact-submissions/AdminSubmissionsClient.tsx:146` | React Hook useEffect has a missing dependency: 'fetchPage'. Either include it or remove the dependency array. |
| `app/admin/contact-submissions/AdminSubmissionsClient.tsx:150` | React Hook useEffect has a missing dependency: 'fetchPage'. Either include it or remove the dependency array. |
| `app/admin/email-templates/TemplateEditor.tsx:108` | React Hook useEffect has missing dependencies: 'insertAtCursor' and 'onImageInsertHandled'. Either include them or remove the dependency array. If 'onImageInsertHandled' changes too often, find the parent component that defines it and wrap that definition in useCallback. |
| `app/admin/email-templates/page.tsx:65` | React Hook useEffect has a missing dependency: 'fetchTemplates'. Either include it or remove the dependency array. |
| `app/admin/guard-profiles/GuardProfileDetailModal.tsx:83` | React Hook useEffect has missing dependencies: 'fetchPayouts', 'fetchReviews', 'payouts.length', and 'reviews.length'. Either include them or remove the dependency array. |
| `app/admin/lead-finder/LeadFinderClient.tsx:145` | React Hook useEffect has missing dependencies: 'load' and 'loadStats'. Either include them or remove the dependency array. |
| `app/admin/lead-finder/LeadFinderClient.tsx:150` | React Hook useEffect has a missing dependency: 'load'. Either include it or remove the dependency array. |
| `app/admin/payg-metrics/page.tsx:32` | React Hook useEffect has a missing dependency: 'fetchMetrics'. Either include it or remove the dependency array. |
| `app/admin/payments/page.tsx:40` | React Hook useEffect has a missing dependency: 'fetchPayments'. Either include it or remove the dependency array. |
| `app/admin/plan-change-history/page.tsx:113` | React Hook useEffect has a missing dependency: 'fetchData'. Either include it or remove the dependency array. |
| `app/admin/settings/page.tsx:94` | React Hook useEffect has a missing dependency: 'loadAll'. Either include it or remove the dependency array. |
| `app/admin/sia-verifications/SIAVerificationsClient.tsx:120` | React Hook useEffect has a missing dependency: 'fetchPage'. Either include it or remove the dependency array. |
| `app/admin/sia-verifications/SIAVerificationsClient.tsx:141` | React Hook useEffect has missing dependencies: 'fetchPage' and 'fetchStats'. Either include them or remove the dependency array. |
| `app/admin/social-media-content/page.tsx:182` | React Hook useEffect has missing dependencies: 'fetchIdeas' and 'fetchPosts'. Either include them or remove the dependency array. |
| `app/admin/subscription-analytics/page.tsx:291` | React Hook useCallback has a missing dependency: 'buildDateFilter'. Either include it or remove the dependency array. |
| `app/admin/subscription-analytics/page.tsx:401` | React Hook useEffect has a missing dependency: 'buildDateFilter'. Either include it or remove the dependency array. |
| `app/admin/subscription-management/page.tsx:128` | React Hook useEffect has a missing dependency: 'mountedRef'. Either include it or remove the dependency array. |
| `app/admin/subscription-management/page.tsx:133` | React Hook useEffect has a missing dependency: 'fetchData'. Either include it or remove the dependency array. |
| `app/admin/subscription-management/page.tsx:137` | React Hook useEffect has a missing dependency: 'fetchData'. Either include it or remove the dependency array. |
| `app/admin/subscription-tracking/page.tsx:277` | React Hook useEffect has a missing dependency: 'fetchAll'. Either include it or remove the dependency array. |
| `app/admin/support-email-review/page.tsx:43` | React Hook useEffect has a missing dependency: 'refresh'. Either include it or remove the dependency array. |
| `app/admin/verify-guards/VerifyGuardsClient.tsx:70` | React Hook useEffect has a missing dependency: 'fetchGuards'. Either include it or remove the dependency array. |
| `app/auth/callback/page.tsx:454` | React Hook useEffect has a missing dependency: 'handleRedirect'. Either include it or remove the dependency array. |
| `app/client/advanced-matching/page.tsx:220` | React Hook useCallback has a missing dependency: 'preferences'. Either include it or remove the dependency array. |
| `app/client/advanced-matching/page.tsx:226` | React Hook useEffect has a missing dependency: 'preferences'. Either include it or remove the dependency array. |
| `app/client/dashboard/CompletionApprovalPanel.tsx:63` | React Hook useEffect has a missing dependency: 'loadRequests'. Either include it or remove the dependency array. |
| `app/client/dashboard/NotificationsPanel.tsx:65` | React Hook useEffect has a missing dependency: 'fetchNotifications'. Either include it or remove the dependency array. |
| `app/client/dashboard/page.tsx:318` | React Hook useCallback has an unnecessary dependency: 'computeOnboarding'. Either exclude it or remove the dependency array. Outer scope values like 'computeOnboarding' aren't valid dependencies because mutating them doesn't re-render the component. |
| `app/client/dashboard/page.tsx:370` | React Hook useEffect has a missing dependency: 'userId'. Either include it or remove the dependency array. |
| `app/client/dashboard/page.tsx:532` | React Hook useEffect has a missing dependency: 'refreshEntitlements'. Either include it or remove the dependency array. |
| `app/client/job-history/page.tsx:286` | React Hook useEffect has missing dependencies: 'currentPage' and 'loadHistory'. Either include them or remove the dependency array. |
| `app/client/jobs/JobDetailDrawer.tsx:33` | React Hook useEffect has a missing dependency: 'loadDetails'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/AssignedGuardsSection.tsx:86` | React Hook useEffect has a missing dependency: 'loadGuardReviews'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/JobDetailClient.tsx:151` | React Hook useEffect has a missing dependency: 'loadJobDetail'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/ReplacementStatusTracker.tsx:112` | React Hook useEffect has a missing dependency: 'loadRequests'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/confirmation/BookingConfirmationClient.tsx:223` | React Hook useEffect has a missing dependency: 'loadData'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/payment/PaymentClient.tsx:210` | React Hook useEffect has a missing dependency: 'loadPaymentData'. Either include it or remove the dependency array. |
| `app/client/jobs/[id]/payment/PaymentClient.tsx:219` | React Hook useEffect has a missing dependency: 'loadPaymentData'. Either include it or remove the dependency array. |
| `app/client/jobs/page.tsx:480` | React Hook useEffect has missing dependencies: 'clientId' and 'loadJobs'. Either include them or remove the dependency array. |
| `app/client/messages/ChatPanel.tsx:160` | React Hook useEffect has a missing dependency: 'messagesEndRef'. Either include it or remove the dependency array. |
| `app/client/messages/MessagesClient.tsx:396` | React Hook useEffect has a missing dependency: 'loadConversations'. Either include it or remove the dependency array. |
| `app/client/messages/MessagesClient.tsx:450` | React Hook useEffect has a missing dependency: 'msgLoadingOlder'. Either include it or remove the dependency array. |
| `app/client/messages/MessagesClient.tsx:541` | React Hook useEffect has a missing dependency: 'loadActiveMessages'. Either include it or remove the dependency array. |
| `app/client/notifications/ReplacementNotificationsSection.tsx:112` | React Hook useEffect has a missing dependency: 'loadRequests'. Either include it or remove the dependency array. |
| `app/client/payment-history/page.tsx:128` | React Hook useEffect has a missing dependency: 'fetchUserAndPayments'. Either include it or remove the dependency array. |
| `app/client/post-job/DuplicateJobModal.tsx:32` | React Hook useEffect has a missing dependency: 'loadPreviousJobs'. Either include it or remove the dependency array. |
| `app/client/post-job/page.tsx:232` | React Hook useEffect has a missing dependency: 'loadTemplate'. Either include it or remove the dependency array. |
| `app/client/reports/page.tsx:184` | React Hook useEffect has missing dependencies: 'thirtyDaysAgo' and 'today'. Either include them or remove the dependency array. |
| `app/client/reviews/page.tsx:68` | React Hook useEffect has a missing dependency: 'loadReviews'. Either include it or remove the dependency array. |
| `app/client/sites/page.tsx:144` | React Hook useEffect has a missing dependency: 'authCtx'. Either include it or remove the dependency array. |
| `app/client/support/TicketDetailDrawer.tsx:98` | React Hook useEffect has a missing dependency: 'loadMessages'. Either include it or remove the dependency array. |
| `app/client/trust-safety/TrustSafetyClient.tsx:108` | React Hook useEffect has a missing dependency: 'jobs'. Either include it or remove the dependency array. |
| `app/guard/bank-settings/page.tsx:59` | React Hook useEffect has a missing dependency: 'checkAuthAndLoadData'. Either include it or remove the dependency array. |
| `app/guard/complete-profile-wizard/page.tsx:170` | React Hook useEffect has missing dependencies: 'loadProfile', 'router', and 'searchParams'. Either include them or remove the dependency array. |
| `app/guard/dashboard/GuardDashboardClient.tsx:208` | React Hook useEffect has missing dependencies: 'loadDashboardData', 'router', and 'traceLog'. Either include them or remove the dependency array. |
| `app/guard/dashboard/GuardDashboardClient.tsx:221` | React Hook useEffect has missing dependencies: 'loadAvailableJobs', 'loadClientResponses', 'loadJobApplications', and 'loadJobAssignments'. Either include them or remove the dependency array. |
| `app/guard/dashboard/GuardDashboardClient.tsx:363` | React Hook useEffect has a missing dependency: 'loadUserEntitlement'. Either include it or remove the dependency array. |
| `app/guard/dashboard/GuardPromoCard.tsx:65` | React Hook useEffect has a missing dependency: 'promo'. Either include it or remove the dependency array. |
| `app/guard/dashboard/NotificationBell.tsx:66` | React Hook useEffect has a missing dependency: 'fetchNotifications'. Either include it or remove the dependency array. |
| `app/guard/dashboard/NotificationHistory.tsx:155` | React Hook useEffect has a missing dependency: 'fetchAll'. Either include it or remove the dependency array. |
| `app/guard/dashboard/ReviewsTab.tsx:65` | React Hook useEffect has a missing dependency: 'fetchReviews'. Either include it or remove the dependency array. |
| `app/guard/earnings/page.tsx:159` | React Hook useMemo has a missing dependency: 'getEffectiveStatus'. Either include it or remove the dependency array. |
| `app/guard/earnings/page.tsx:254` | React Hook useMemo has a missing dependency: 'getEffectiveStatus'. Either include it or remove the dependency array. |
| `app/guard/jobs/[id]/GuardJobDetailClient.tsx:167` | React Hook useCallback has a missing dependency: 'loadPaymentFlow'. Either include it or remove the dependency array. |
| `app/guard/messages/GuardMessagesClient.tsx:307` | React Hook useEffect has a missing dependency: 'loadActiveMessages'. Either include it or remove the dependency array. |
| `app/guard/payment-centre/page.tsx:78` | React Hook useEffect has a missing dependency: 'refreshStripeStatus'. Either include it or remove the dependency array. |
| `app/guard/support/TicketDetailDrawer.tsx:90` | React Hook useEffect has a missing dependency: 'loadMessages'. Either include it or remove the dependency array. |
| `app/guard/verification-pending/page.tsx:96` | React Hook useEffect has missing dependencies: 'checkVerificationStatus' and 'startPolling'. Either include them or remove the dependency array. |
| `app/jobs/JobsClient.tsx:83` | React Hook useEffect has a missing dependency: 'fetchJobs'. Either include it or remove the dependency array. |
| `app/jobs/JobsClient.tsx:87` | React Hook useEffect has a missing dependency: 'applyFilters'. Either include it or remove the dependency array. |
| `components/AdminSidebar.tsx:212` | React Hook useEffect has a missing dependency: 'isActive'. Either include it or remove the dependency array. |
| `components/GuardUsageWidget.tsx:27` | React Hook useEffect has a missing dependency: 'loadUsage'. Either include it or remove the dependency array. |
| `components/PlanManagementCard.tsx:112` | React Hook useEffect has a missing dependency: 'load'. Either include it or remove the dependency array. |
