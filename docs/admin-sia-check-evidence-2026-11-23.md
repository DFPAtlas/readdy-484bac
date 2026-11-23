# Admin SIA register-check evidence

A read-only review found profile licence numbers that differ from the number submitted for a recorded register check. One difference was whitespace only; another was a genuinely different number on a labelled test account. These records do not authorise a new approval, reviewer, verification timestamp or document reference.

The register panel compared the checked licence number with itself under both the applicant and register columns, even for a not-found result. It did not show a changed current profile number, and could show a previous Approve badge as current evidence. An empty history also displayed Check in progress; a failed history read displayed an empty-history claim.

The panel now displays the current profile licence and the licence submitted for the check separately, preserving their raw values. Only matching 16-digit numbers after whitespace removal retain the result as linked to the current licence. Different, absent or malformed identifiers produce a Historical check badge and a warning that the check does not verify the current profile licence. The actual decision remains visible in history. This comparison establishes licence identity only, not current validity, document completeness, identity matching or approval eligibility.

The misleading register-number comparison is removed: the queue's submitted number is not claimed as a value returned by the register. Current profile licence type stays explicitly labelled as profile data, while recorded name comparisons are labelled Submitted for check. Loading, empty history and failed reads have separate states; failed reads do not retain a positive result or claim that no history exists.

All six actual-component regressions pass, including a reproduced previous-Approve/different-licence case, whitespace-only formatting, missing/invalid identifiers, not-found results, loading/empty/pending history and a failed read. The full suite passed 1,109 tests with concurrency two, including the six final evidence-panel tests. Repository and admin/financial TypeScript passed. Lint had zero errors and ten existing warnings. The production build passed with 214 pages using unreachable placeholder Supabase settings; the generated next-env reference was restored. git diff --check passed.

No guard, approval, verification, SIA queue, worker, document, billing, access or database record was changed. No SIA worker was invoked. Missing historical reviewer/document evidence remains for the authorised reviewer; the frontend cannot recreate it. No eligibility rule or HAL classification is changed.

After merge, import main into Readdy and publish. Then check a matching licence, a genuinely different recorded licence, missing history, and the retained historical decision on the live admin page. No migration or Edge Function deployment is required. Full admin sign-off and live approval UAT remain open.
