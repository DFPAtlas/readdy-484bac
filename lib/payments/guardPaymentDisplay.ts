const PAID_STATUSES = new Set(['paid', 'completed', 'paid_out', 'succeeded', 'transferred', 'payout_paid']);
const REFUNDED_STATUSES = new Set(['cancelled', 'refunded', 'refund_completed', 'reversed']);

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[\s-]+/g, '_');
}

export function isPaidGuardPayoutStatus(status: string | null | undefined): boolean {
  return PAID_STATUSES.has(normalize(status));
}

export function recordedGuardAmount(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
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
    if (!isPaidGuardPayoutStatus(payout.status)) return total;
    return total + recordedGuardAmount(payout.net_amount ?? payout.amount);
  }, 0);
}

type Money = number | string | null;
interface Payout { status?: string | null; amount?: Money; net_amount?: Money; }
interface HistoryMoneyJob {
  job_status?: string | null;
  assignment_status?: string | null;
  dispute_status?: string | null;
  payout_released?: boolean;
  payment_amount?: Money;
  guard_payout_amount?: Money;
  payout?: Payout | null;
}

/** Paid earnings use payout receipts, never the face value of cancelled jobs. */
export function guardHistoryTotals(jobs: HistoryMoneyJob[], payouts: Payout[]) {
  const paid = sumPaidGuardPayouts(payouts);
  const pending = jobs.reduce((sum, job) => {
    if (job.assignment_status !== 'completed' || job.job_status === 'cancelled' || job.payout_released ||
        ['open', 'under_review'].includes(job.dispute_status || '') || isPaidGuardPayoutStatus(job.payout?.status) ||
        ['refunded', 'reversed', 'cancelled', 'failed'].includes(job.payout?.status || '')) return sum;
    return sum + recordedGuardAmount(job.payout?.net_amount ?? job.payout?.amount ?? job.guard_payout_amount ?? job.payment_amount);
  }, 0);
  return { totalEarned: paid, releasedPayout: paid, pendingPayout: pending };
}
