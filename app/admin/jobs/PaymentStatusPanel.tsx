'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { paymentTotals, FinancialPayment } from '@/lib/financeAmounts';
import Link from 'next/link';

interface JobPaymentRow {
  id: string; job_title: string; venue_city: string; start_date: string;
  payment_status: string | null; guard_payout_amount: number | null; status: string;
  clients: { company_name: string | null } | null;
  collected: number; refunded: number; remaining: number;
}
const PAGE_SIZE = 25;
const currency = (amount: number) => new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'}).format(amount);

export default function PaymentStatusPanel() {
  const [jobs, setJobs] = useState<JobPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [audit, setAudit] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const loadJobs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase.from('jobs').select('id, job_title, venue_city, start_date, payment_status, guard_payout_amount, status, clients(company_name)', {count: 'exact'})
        .eq('is_deleted', false).not('payment_status', 'is', null);
      if (filter !== 'all') query = query.eq('payment_status', filter);
      const {data, error: jobError, count: total} = await query.order('updated_at', {ascending: false}).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (jobError) throw jobError;
      const ids = (data || []).map(j => j.id);
      const transactions: (FinancialPayment & {job_id: string})[] = [];
      if (ids.length) {
        // Page the related payments too; PostgREST's row cap must not truncate totals.
        for (let offset = 0; ; offset += 500) {
          const result = await supabase.from('transactions').select('id, job_id, amount, status, refunded, refund_amount').eq('transaction_type', 'job_payment').in('job_id', ids).order('id').range(offset, offset + 499);
          if (result.error) throw result.error;
          transactions.push(...(result.data || []));
          if ((result.data || []).length < 500) break;
        }
      }
      setJobs((data || []).map(j => ({...j, clients: Array.isArray(j.clients) ? j.clients[0] || null : j.clients,
        ...paymentTotals(transactions.filter(t => t.job_id === j.id))})));
      setCount(total || 0);
    } catch (err) {setError(err instanceof Error ? err.message : 'Unable to load payment records'); setJobs([]);}
    finally {setLoading(false);}
  }, [page, filter]);
  useEffect(() => {void loadJobs();}, [loadJobs]);
  useEffect(() => {
    if (!showAudit) return;
    setAuditLoading(true); setAuditError(null);
    void (async () => {
      const {data, error} = await supabase.from('payment_audit_logs').select('id, job_id, event_type, from_status, to_status, reason, created_at').order('created_at', {ascending: false}).limit(50);
      if (error) {setAuditError(error.message); setAudit([]);} else setAudit(data || []);
      setAuditLoading(false);
    })();
  }, [showAudit]);
  return <section id="payment-status" className="mt-8 rounded-2xl border border-[#1e2d4d] bg-[#111d35] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div><h2 className="text-xl font-bold text-white">Job payments</h2><p className="text-sm text-slate-300 mt-1">Collected, refunded and remaining funds before fees and payouts.</p></div>
      <div className="flex gap-3"><button onClick={() => setShowAudit(!showAudit)} aria-expanded={showAudit} className="text-teal-300">{showAudit ? 'Hide audit' : 'Recent audit'}</button><button disabled={loading} onClick={() => void loadJobs()} className="text-teal-300 disabled:opacity-50">Refresh</button></div>
    </div>
    <p className="mb-4 rounded-lg bg-[#0a1527] p-3 text-sm text-slate-300">Payment states come from verified payment workflows. Use completion requests for payout approval and disputes for refunds; a status edit cannot release or refund money.</p>
    <label className="text-sm text-slate-300">Payment state <select aria-label="Payment state" value={filter} onChange={e => {setFilter(e.target.value); setPage(0);}} className="ml-2 mb-4 rounded-lg bg-[#0a1527] p-2 text-white">
      {['all','unpaid','payment_pending','funded','partially_refunded','refund_pending','refunded','disputed','payout_pending','payout_processing','paid_out','released'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
    </select></label>
    {error ? <div role="alert" className="text-rose-300 py-4">Payment records could not be loaded: {error} <button onClick={() => void loadJobs()} className="underline">Retry</button></div> : loading ? <p role="status" className="text-slate-300 py-4">Loading payments…</p> : jobs.length === 0 ? <p className="text-slate-300 py-4">No payments match this filter.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300"><thead><tr>{['Job','State','Collected','Refunded','Remaining','Planned guard payout','Workflow'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{jobs.map(j => <tr key={j.id} className="border-t border-[#1e2d4d]"><td className="p-3"><p className="text-white">{j.job_title}</p><p>{j.clients?.company_name || 'Unknown client'}</p></td><td className="p-3">{j.payment_status?.replaceAll('_',' ') || 'Unknown'}{j.refunded > 0 && j.remaining > 0 && <p className="text-amber-300">Partial refund recorded</p>}</td><td className="p-3">{currency(j.collected)}</td><td className="p-3">{currency(j.refunded)}</td><td className="p-3">{currency(j.remaining)}</td><td className="p-3">{currency(Number(j.guard_payout_amount) || 0)}{j.refunded > 0 && <p className="text-amber-300">Finance review required after refund</p>}</td><td className="p-3"><Link className="text-teal-300 block" href="/admin/jobs#completion-requests">Completion requests</Link><Link className="text-teal-300 block" href="/admin/jobs#disputes">Disputes / refunds</Link><Link className="text-teal-300 block" href={`/jobs/detail?id=${j.id}`}>View job</Link></td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex items-center justify-between text-sm text-slate-300"><span>{count} matching jobs · Page {page + 1} of {Math.max(1,Math.ceil(count/PAGE_SIZE))}</span><div className="flex gap-4"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">Previous</button><button disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next</button></div></div>
    {showAudit && <div className="mt-6 border-t border-[#1e2d4d] pt-4"><h3 className="font-bold text-white">Latest 50 payment audit entries</h3>{auditLoading ? <p className="text-slate-300">Loading audit…</p> : auditError ? <p role="alert" className="text-rose-300">Audit could not be loaded: {auditError}</p> : audit.length === 0 ? <p className="text-slate-300">No entries recorded.</p> : <ul className="divide-y divide-[#1e2d4d]">{audit.map(log => <li key={log.id} className="py-3 text-sm text-slate-300">{new Date(log.created_at).toLocaleString('en-GB')} · {log.event_type || log.to_status} · {log.reason || 'No note'}</li>)}</ul>}</div>}
  </section>;
}
