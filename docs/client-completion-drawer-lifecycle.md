# Client completion and job drawer lifecycle review

Completion requests and job-detail reads could finish after the selected client/job changed. Completion refreshes could also complete out of order. The dependency warnings pointed to loaders captured by effects without declaring their dependencies.

## Repairs

- Completion loader now has stable explicit dependencies, aborts superseded fetches and checks request ownership after session and JSON reads. Switching scope resets the selected review. Malformed responses and transport failures stay visible as errors; Retry remains available.
- Job drawer now reloads on client identity as well as job ID, clears previous assignments, transactions, reviews, cancellation and refund details, and discards results after scope changes, newer retries or unmounting. Returned query errors produce a retryable booking-details alert instead of partial successful data.
- No lint rule is suppressed.

## Tests

Five new tests execute the actual loader/effect code with deferred responses. They cover completion job filtering, scope changes and modal reset, overlapping retries, genuine transport errors, late session resolution after unmount, drawer job/client changes, returned query errors and stable dependencies that do not cause refresh loops.

This repair covers fetching and displaying these records. Completion approval/dispute mutations and the remaining dependency warnings still need separate review. It does not provide full-site launch sign-off.
