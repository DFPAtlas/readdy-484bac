import { CLIENT_CANCELLABLE_STATUSES } from './customer-guidance';

// UI eligibility follows cancel_client_job. The RPC remains authoritative for
// ownership, concurrent changes and any payment/payout already in flight.
export function canClientCancelJob(job: { status?: string | null; is_deleted?: boolean | null }) {
  return job.is_deleted !== true && (CLIENT_CANCELLABLE_STATUSES as readonly string[]).includes(job.status || '');
}

// These are the existing create-review service rules, not just work completion.
export const CLIENT_REVIEWABLE_STATUSES = ['paid_out', 'review_pending'] as const;
export function canClientReviewAssignment(
  job: { status?: string | null; is_deleted?: boolean | null },
  assignment: { status?: string | null; payment_status?: string | null },
) {
  return job.is_deleted !== true && (CLIENT_REVIEWABLE_STATUSES as readonly string[]).includes(job.status || '') &&
    assignment.status === 'completed' && assignment.payment_status === 'paid_out';
}

export async function cancelClientJobs(db: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> }, jobs: { id: string; status: string; is_deleted?: boolean | null }[]) {
  let cancelled = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of jobs) {
    if (!canClientCancelJob(job)) { skipped++; continue; }
    try {
      const { data, error } = await db.rpc('cancel_client_job', {
        p_job_id: job.id, p_reason: 'Client bulk cancellation',
        p_notes: null, p_resolution: 'full_refund', p_contact: 'email',
      });
      if (error || !data?.success || !data?.cancellationId) { failed++; continue; }
      cancelled++;
    } catch { failed++; }
  }
  return { cancelled, failed, skipped };
}
