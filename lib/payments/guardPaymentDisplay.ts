const PAID_STATUSES = new Set(['paid', 'completed', 'paid_out', 'succeeded', 'transferred', 'payout_paid']);
const REFUNDED_STATUSES = new Set(['cancelled', 'refunded', 'refund_completed', 'reversed']);

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[\s-]+/g, '_');
}

export interface GuardPaymentDisplaySource {
  payoutStatus?: string | null;
  jobStatus?: string | null;
  jobPaymentStatus?: string | null;
  assignmentStatus?: string | null;
  assignmentPaymentStatus?: string | null;
}

/** Prefer the payout record, then fall back to explicit job/assignment states. */
export function deriveGuardPaymentDisplayStatus(source: GuardPaymentDisplaySource): string {
  const payoutStatus = normalize(source.payoutStatus);
  if (payoutStatus) return payoutStatus;

  const jobStatus = normalize(source.jobStatus);
  const jobPaymentStatus = normalize(source.jobPaymentStatus);
  const assignmentStatus = normalize(source.assignmentStatus);
  const assignmentPaymentStatus = normalize(source.assignmentPaymentStatus);

  if (
    REFUNDED_STATUSES.has(jobStatus) ||
    REFUNDED_STATUSES.has(jobPaymentStatus) ||
    REFUNDED_STATUSES.has(assignmentStatus) ||
    REFUNDED_STATUSES.has(assignmentPaymentStatus)
  ) return jobPaymentStatus === 'refunded' ? 'refunded' : 'cancelled';

  if (PAID_STATUSES.has(jobPaymentStatus) || PAID_STATUSES.has(assignmentPaymentStatus)) return 'paid_out';
  if (jobStatus === 'awaiting_client_approval') return 'awaiting_approval';
  if (jobStatus === 'payout_approved' || assignmentPaymentStatus === 'payout_pending') return 'payout_pending';
  if (jobPaymentStatus === 'funded' || assignmentPaymentStatus === 'funded') return 'funded';

  return assignmentPaymentStatus || jobPaymentStatus || 'pending';
}

export function sumPaidGuardPayouts(
  payouts: Array<{ status?: string | null; net_amount?: number | string | null; amount?: number | string | null }>
): number {
  return payouts.reduce((total, payout) => {
    if (!PAID_STATUSES.has(normalize(payout.status))) return total;
    const amount = Number(payout.net_amount ?? payout.amount ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}
