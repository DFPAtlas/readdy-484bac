'use client';

import { useClientFinance } from '@/hooks/useClientFinance';
import { paymentsInRange, type PaymentRange } from '@/lib/client-finance';
import { paymentTotals } from '@/lib/financeAmounts';

export default function ClientSpendingSummary({ range = {}, subscriptions = false }: { range?: PaymentRange; subscriptions?: boolean }) {
  const { data, loading, error, reload } = useClientFinance();
  if (loading) return <p className="text-sm text-slate-400 mb-6" role="status">Loading payment totals…</p>;
  if (error || !data) return <div role="alert" className="p-4 mb-6 rounded-xl border border-red-500/30 text-red-400"><p>{error || 'Payment totals unavailable.'}</p><button type="button" onClick={reload} className="mt-2 underline">Retry payment totals</button></div>;
  const job = paymentTotals(paymentsInRange(data.transactions, range));
  const sub = paymentTotals(paymentsInRange(data.subscriptionPayments, range));
  const rows = [{ label: 'Gross Job Payments', value: job.collected }, { label: 'Job Refunds', value: job.refunded }, { label: 'Net Job Spend', value: job.remaining },
    ...(subscriptions ? [{ label: 'Gross Subscription Payments', value: sub.collected }, { label: 'Subscription Refunds', value: sub.refunded }, { label: 'Net Subscription Spend', value: sub.remaining }] : [])];
  return <section aria-label="Recorded payment totals" className="mb-6">
    <p className="text-sm text-slate-400 mb-3">{range.from || range.to ? 'Selected payment period (UK dates)' : 'All-time recorded payments'}. Gross payments minus completed refunds equals net spend. Pending and failed attempts are excluded.</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{rows.map(row => <div key={row.label} className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4"><p className="text-sm text-slate-400">{row.label}</p><p className="text-2xl font-bold text-slate-900 dark:text-white">£{row.value.toFixed(2)}</p></div>)}</div>
    <p className="text-xs text-slate-500 mt-3">Includes retained payment records for cancelled or deleted jobs. {range.from || range.to ? 'The period selects payment creation dates; refunds are the recorded lifetime refunds on those payments.' : 'Subscription charges are separate from job payments.'}</p>
  </section>;
}
