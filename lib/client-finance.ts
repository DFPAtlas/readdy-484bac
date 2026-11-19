import { readAllClientRows } from './client-job-list';
import { isCollected, paymentAmounts, paymentTotals } from './financeAmounts';

export interface PaymentRange { from?: string; to?: string; }
export function ukPaymentDay(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** A period selects payment records by their creation date in the UK.
 * Refund totals are the recorded lifetime refunds on those selected payments. */
export function paymentsInRange<T extends { created_at: string }>(rows: T[], range: PaymentRange = {}): T[] {
  if (!range.from && !range.to) return rows;
  return rows.filter(row => { const day = ukPaymentDay(row.created_at); return !!day && (!range.from || day >= range.from) && (!range.to || day <= range.to); });
}

export async function loadClientFinanceRecords(db: any, clientId: string, userId: string) {
  const [transactions, subscriptionPayments, payableJobs] = await Promise.all([
    readAllClientRows(() => db.from('transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).order('id', { ascending: false })),
    readAllClientRows(() => db.from('subscription_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false })),
    readAllClientRows(() => db.from('jobs').select('id, status, payment_status, agreed_amount').eq('client_id', clientId).eq('is_deleted', false).in('status', ['awaiting_payment']).order('id', { ascending: true })),
  ]);
  for (const row of [...transactions, ...subscriptionPayments]) {
    const invalidAmount = row.amount === null || (typeof row.amount === 'string' && !row.amount.trim()) || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0;
    const invalidRefund = row.refund_amount != null && (!Number.isFinite(Number(row.refund_amount)) || Number(row.refund_amount) < 0);
    if (!row.id || typeof row.created_at !== 'string' || !ukPaymentDay(row.created_at) || typeof row.status !== 'string' || invalidAmount || invalidRefund || (row.currency && row.currency.toLowerCase() !== 'gbp')) throw new Error('Payment totals are unavailable for these records.');
  }
  return { transactions, subscriptionPayments, payableJobs };
}

export function clientSpendingSummary(transactions: any[], payableJobs: any[], now = new Date()) {
  const totals = paymentTotals(transactions);
  const day = ukPaymentDay(now.toISOString())!;
  const monthTotals = paymentTotals(paymentsInRange(transactions, { from: day.slice(0, 7) + '-01', to: day }));
  const paidJobs = new Set(transactions.filter(t => t.job_id && isCollected(t.status)).map(t => t.job_id));
  let outstandingPence = 0;
  let outstandingUnknownJobs = 0;
  for (const job of payableJobs) {
    if (job.is_deleted === true || job.status !== 'awaiting_payment' || ['funded', 'paid', 'refunded'].includes(job.payment_status) || paidJobs.has(job.id)) continue;
    const pending = transactions.filter(t => t.job_id === job.id && ['pending', 'pending_payment'].includes(t.status)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)))[0];
    // One current booking value per job. Old retries are not additional debt.
    const raw = job.agreed_amount ?? pending?.amount;
    const value = Number(raw);
    if (raw == null || raw === '' || !Number.isFinite(value) || value < 0) outstandingUnknownJobs++;
    else outstandingPence += Math.round(value * 100);
  }
  return { thisMonthSpend: monthTotals.collected, totalSpend: totals.collected, jobsPaid: paidJobs.size, outstandingAmount: outstandingPence / 100, outstandingUnknownJobs, refundsTotal: totals.refunded, netSpend: totals.remaining };
}

export function clientJobPaymentLabel(job: { payment_status?: string | null; transactions: any[] }): string {
  const totals = paymentTotals(job.transactions);
  if (totals.collected > 0) {
    if (totals.refunded === totals.collected) return 'Refunded';
    // Compact history transactions may omit refund amounts. Their explicit
    // state still supports a badge; monetary totals use the complete ledger.
    if (totals.refunded > 0 || job.transactions.some(t => t.status === 'partially_refunded')) return 'Partially Refunded';
    return 'Paid';
  }
  if (job.payment_status === 'funded') return 'Funded';
  if (isCollected(job.payment_status)) return job.payment_status === 'refunded' ? 'Refunded' : job.payment_status === 'partially_refunded' ? 'Partially Refunded' : 'Paid';
  if (['pending', 'awaiting_payment'].includes(job.payment_status || '')) return 'Pending';
  if (job.transactions.some(t => t.status === 'failed') || job.payment_status === 'failed') return 'Failed';
  return job.payment_status === 'unpaid' ? 'Unpaid' : 'Payment status unavailable';
}

export function paymentRefundLabel(payment: any): string {
  const amounts = paymentAmounts(payment);
  return amounts.refunded > 0 && amounts.refunded < amounts.collected ? `Partially refunded (£${amounts.refunded.toFixed(2)})` : amounts.refunded > 0 ? 'Refunded' : '—';
}
