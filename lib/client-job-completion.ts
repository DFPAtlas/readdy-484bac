// Work completion is independent of payout settlement. Closed bookings may
// simply be archived, so closure alone is not evidence of completed work.
export const CLIENT_COMPLETED_JOB_STATUSES = ['completed', 'payout_approved', 'paid_out', 'review_pending'];

export function isCompletedClientJobStatus(status: string): boolean {
  return CLIENT_COMPLETED_JOB_STATUSES.includes(status);
}
