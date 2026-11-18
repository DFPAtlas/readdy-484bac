# Replacement candidate details

The replacement suggestion card's View Profile button navigated to the job's entire applicant list. The URL did not identify the chosen guard, and candidates from public-profile or client-history matches need not be applicants to this job.

The action is now View details and expands the selected candidate's existing public-profile snapshot in place. It shows supplied location, experience, completed-job/review counts, rating and QuickGuard verification state. Missing values are labelled; zero counts are preserved. Availability and suitability remain unconfirmed. No additional profile query or private contact/account field is introduced. The obsolete applicant link and nested link/button are removed.

Only one candidate's details can be expanded at a time. Named buttons expose their expanded state and controlled section. Hide details closes the section. Refresh clears it, including when the same guard returns or refresh fails. Existing job/client/assignment search keys retire details with the candidate list when context changes. Request guard continues to pass the selected guard to the replacement form.

Three new behavioral tests cover correct candidate selection, switching/hiding, accessible control/section association, missing/zero values, no applicant navigation, no extra reads, private-field omission, preserved request selection and refresh cleanup. All 17 focused suggestion/request tests passed. Full-suite, TypeScript, repository lint, admin/financial gate and production-build results are recorded in the PR.

After GitHub checks and merge, import latest main into Readdy and publish. This repair needs no database migration or Edge Function deployment. Signed-in visual checks remain outstanding: expand two different candidates, hide details, request the selected guard without submitting, and refresh the list. Confirm details match the selected candidate and no applicant-page navigation occurs. Verification made no live bookings, replacement requests, support tickets or notifications.
