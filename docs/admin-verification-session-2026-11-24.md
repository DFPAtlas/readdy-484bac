# Admin guard verification session handling — 24 November 2026

The published dashboard's “Guards Awaiting Verification” link points to the correct route. An authenticated-looking shell opened that route, but get-guards returned 401 and the page displayed raw Unauthorized JSON briefly before claiming there were no guards. Read-only Auth logs confirmed the underlying server response was session_not_found: the cached browser JWT no longer represented a current server session. Sidebar counts failed for the same session.

The protected admin layout now calls Auth getUser before its existing active-admin, role and MFA checks. An invalid or absent verified user clears the admin cache and signs out locally before returning to login; cached identity cannot mount protected screens. No access rules, MFA requirements or backend authorization are weakened.

Guard-list failures now remain visible, provide sign-in or retry guidance and suppress the empty-list/result count. Failed or unavailable tab counts display an em dash; a genuine successful empty list still displays zero. A missing token does not initiate guard-list/count requests. Unrecognized successful response shapes are treated as load failures. Provider error text is not rendered. The existing guard review, approval and rejection actions are unchanged.

Behavioral regressions cover revoked/missing sessions, all three allowed admin roles, inactive/disallowed roles, MFA routing, 401/403, network/server failures and recovery, missing credentials, malformed responses and the genuine empty state. Existing SIA display regressions also run.

No production guard record, verification decision, payment, account permission or Edge Function is changed. This frontend repair requires merge and Readdy publication. After the user completed a fresh sign-in, the published dashboard link successfully opened Guard Verifications with 11 results and populated counts. This confirms session recovery and the existing backend response. The new expired-session UI and layout changes still require publication and a separate acceptance check; the successful live check used the currently published frontend.
