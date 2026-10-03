import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
export type FinancialOperation = {id: string; replayed: boolean; result?: Record<string, unknown>};
export async function claimFinancialOperation(db: SupabaseClient, jobId: string, key: string, kind: string, actor: string | null): Promise<FinancialOperation> {
  const {data, error} = await db.rpc('claim_financial_operation', {p_job_id: jobId, p_key: key, p_kind: kind, p_actor: actor});
  if (error || !data) throw {status: 409, message: error?.message || 'Financial operation could not be reserved'};
  return data;
}
export async function finishFinancialOperation(db: SupabaseClient, id: string, result: Record<string, unknown>) {
  const {error} = await db.from('financial_operations').update({state: 'completed', result, updated_at: new Date().toISOString()}).eq('id',id).eq('state','processing');
  if (error) throw new Error('Financial operation could not be completed; reconciliation required');
}
export async function holdFinancialOperation(db: SupabaseClient, id: string, stripeStarted: boolean) {
  // Never release an uncertain Stripe operation automatically or after a timeout.
  const {error} = await db.from('financial_operations').update({state: stripeStarted ? 'reconciliation_required' : 'failed', updated_at: new Date().toISOString()}).eq('id',id).eq('state','processing');
  if (error) console.error('[FinancialOperation] Could not record review state');
}
export async function verifyRefundSafety(db: SupabaseClient, job: {id: string; status: string; payment_status: string}) {
  const [assignments,payouts] = await Promise.all([
    db.from('job_assignments').select('payment_status,payout_released,stripe_transfer_id').eq('job_id',job.id),
    db.from('guard_payouts').select('status,stripe_transfer_id').eq('job_id',job.id),
  ]);
  if (assignments.error || payouts.error) throw new Error('Unable to verify payout safety');
  const protectedStates = ['payout_pending','payout_processing','paid_out','paid','client_released','released'];
  if (['payout_approved','paid_out'].includes(job.status) || protectedStates.includes(job.payment_status) ||
    (assignments.data || []).some(a => protectedStates.includes(a.payment_status) || a.payout_released || a.stripe_transfer_id) ||
    (payouts.data || []).some(p => p.stripe_transfer_id || !['failed','cancelled'].includes(p.status))) {
    throw {status: 409, message: 'Refund blocked: guard payout has started. Finance recovery review required.'};
  }
}
