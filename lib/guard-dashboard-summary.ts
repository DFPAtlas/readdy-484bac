import { isPaidGuardPayoutStatus } from './payments/guardPaymentDisplay';

export interface GuardDashboardSummary {
  completed: number;
  earned: number;
  pending: number;
  recentPayouts: { amount: number }[];
}

/** Use owned assignments and retained payout records, never profile caches or job face values. */
export async function loadGuardDashboardSummary(db: any, guardId: string): Promise<GuardDashboardSummary> {
  if (!guardId) throw new Error('Guard account is unavailable.');
  const completed = await db.from('job_assignments').select('id', { count: 'exact', head: true })
    .eq('guard_id', guardId).eq('status', 'completed');
  if (completed.error || !Number.isSafeInteger(completed.count) || completed.count < 0) {
    throw new Error('Completed shifts could not be loaded.');
  }
  const ids = new Set<string>();
  const paid: { amount: number }[] = [];
  let earned = 0;
  let pending = 0;
  for (let offset = 0; ; offset += 200) {
    const result = await db.from('guard_payouts').select('id, guard_id, status, amount, net_amount, created_at')
      .eq('guard_id', guardId).order('created_at', { ascending: false }).order('id', { ascending: true })
      .range(offset, offset + 199);
    if (result.error || !Array.isArray(result.data)) throw new Error('Payout totals could not be loaded.');
    for (const row of result.data) {
      if (!row.id || ids.has(row.id) || row.guard_id !== guardId || typeof row.status !== 'string') {
        throw new Error('Payout totals could not be verified.');
      }
      ids.add(row.id);
      const status = row.status.toLowerCase().replace(/[\s-]+/g, '_');
      if (!isPaidGuardPayoutStatus(status) && !['pending', 'processing', 'payout_pending', 'approved'].includes(status)) continue;
      const value = row.net_amount ?? row.amount;
      const amount = Number(value);
      if ((typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) || !Number.isFinite(amount) || amount < 0) {
        throw new Error('Payout amount could not be verified.');
      }
      if (isPaidGuardPayoutStatus(status)) {
        earned += Math.round(amount * 100);
        if (paid.length < 7) paid.push({ amount });
      } else pending += Math.round(amount * 100);
    }
    if (result.data.length < 200) break;
  }
  return { completed: completed.count, earned: earned / 100, pending: pending / 100, recentPayouts: paid.reverse() };
}
