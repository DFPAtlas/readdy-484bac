'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface JobPaymentRow {
  id: string;
  job_title: string;
  venue_city: string;
  start_date: string;
  hourly_rate: number;
  number_of_guards: number;
  payment_status: string | null;
  agreed_amount: number | null;
  platform_fee: number | null;
  guard_payout_amount: number | null;
  status: string;
  clients: { company_name: string | null; email: string | null } | null;
}

const paymentStatusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  unpaid: { label: 'Unpaid', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'ring-slate-500/20', icon: 'ri-money-pound-circle-line' },
  payment_pending: { label: 'Awaiting Payment', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'ring-amber-500/20', icon: 'ri-time-line' },
  funded: { label: 'Funded', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'ring-emerald-500/20', icon: 'ri-shield-check-line' },
  completed: { label: 'Completed', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'ring-teal-500/20', icon: 'ri-checkbox-circle-line' },
  disputed: { label: 'Disputed', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'ring-orange-500/20', icon: 'ri-alert-line' },
  released: { label: 'Released', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'ring-blue-500/20', icon: 'ri-send-plane-line' },
  refunded: { label: 'Refunded', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'ring-rose-500/20', icon: 'ri-refund-line' },
};

export default function PaymentStatusPanel() {
  const [jobs, setJobs] = useState<JobPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('jobs')
        .select('id, job_title, venue_city, start_date, hourly_rate, number_of_guards, payment_status, agreed_amount, platform_fee, guard_payout_amount, status, clients(company_name, email)')
        .eq('is_deleted', false)
        .not('payment_status', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      setJobs((data || []) as JobPaymentRow[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const updatePaymentStatus = async (jobId: string, newStatus: string, reason?: string) => {
    setUpdating(jobId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-job-mutate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'update_payment_status', jobId, newPaymentStatus: newStatus, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status');

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, payment_status: newStatus } : j));
      setToast({ message: `Payment status updated to ${newStatus}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update payment status', type: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.payment_status === filter);

  const statusCounts = {
    all: jobs.length,
    payment_pending: jobs.filter(j => j.payment_status === 'payment_pending').length,
    funded: jobs.filter(j => j.payment_status === 'funded').length,
    disputed: jobs.filter(j => j.payment_status === 'disputed').length,
    completed: jobs.filter(j => j.payment_status === 'completed').length,
    released: jobs.filter(j => j.payment_status === 'released').length,
    unpaid: jobs.filter(j => j.payment_status === 'unpaid').length,
  };

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const { data } = await supabase
        .from('payment_audit_logs')
        .select('id, job_id, from_status, to_status, changed_by_role, reason, created_at, jobs:job_id(job_title)')
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs(data || []);
    } catch {}
    setAuditLoading(false);
  };

  useEffect(() => {
    if (showAudit) loadAuditLogs();
  }, [showAudit]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white">Job Payment Status</h2>
          <p className="text-sm text-slate-400 mt-1">Track funding, disputes, and payouts for all jobs with payment activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudit(!showAudit)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              showAudit ? 'bg-teal-500/10 text-teal-400' : 'bg-[#111d35] text-slate-400 hover:bg-[#1a2642] border border-[#1e2d4d]'
            }`}>
            <i className="ri-history-line"></i>
            {showAudit ? 'Hide Audit Log' : 'Audit Log'}
          </button>
          <button onClick={loadJobs} className="px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer">
            <i className="ri-refresh-line"></i>Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 mb-6">
        {[
          { key: 'all', label: 'All', count: statusCounts.all, color: 'text-slate-400 bg-[#111d35] ring-[#1e2d4d]' },
          { key: 'unpaid', label: 'Unpaid', count: statusCounts.unpaid, color: 'text-slate-400 bg-slate-500/10 ring-slate-500/20' },
          { key: 'payment_pending', label: 'Awaiting', count: statusCounts.payment_pending, color: 'text-amber-400 bg-amber-500/10 ring-amber-500/20' },
          { key: 'funded', label: 'Funded', count: statusCounts.funded, color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
          { key: 'disputed', label: 'Disputed', count: statusCounts.disputed, color: 'text-orange-400 bg-orange-500/10 ring-orange-500/20' },
          { key: 'released', label: 'Released', count: statusCounts.released, color: 'text-blue-400 bg-blue-500/10 ring-blue-500/20' },
          { key: 'completed', label: 'Completed', count: statusCounts.completed, color: 'text-teal-400 bg-teal-500/10 ring-teal-500/20' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`rounded-xl ring-1 px-3 py-3 text-center transition-all cursor-pointer ${s.color} ${filter === s.key ? 'ring-2 shadow-sm' : ''}`}>
            <p className="text-xl font-extrabold">{s.count}</p>
            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {showAudit && (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-[#1e2d4d] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Payment Audit Log</h3>
            <button onClick={loadAuditLogs} className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer">Refresh</button>
          </div>
          {auditLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-slate-400">Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No audit logs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0a1527] border-b border-[#1e2d4d]">
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Job</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">From</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">To</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Role</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-[#1a2642] hover:bg-[#1a2642]/50">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{(log.jobs as any)?.job_title || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{log.from_status || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          log.to_status === 'released' ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                          : log.to_status === 'disputed' ? 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20'
                          : log.to_status === 'funded' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
                        }`}>{log.to_status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{log.changed_by_role || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{log.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading payment data...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-12 text-center">
          <div className="w-12 h-12 bg-[#0a1527] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e2d4d]">
            <i className="ri-secure-payment-line text-2xl text-slate-500"></i>
          </div>
          <p className="text-sm text-slate-400">No jobs match this filter</p>
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1527] border-b border-[#1e2d4d]">
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Agreed Amount</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Platform Fee</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Guard Payout</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Payment Status</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => {
                  const psc = job.payment_status ? (paymentStatusConfig[job.payment_status] || paymentStatusConfig.unpaid) : paymentStatusConfig.unpaid;
                  const isBusy = updating === job.id;
                  return (
                    <tr key={job.id} className="border-b border-[#1a2642] hover:bg-[#1a2642]/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{job.job_title}</p>
                        <p className="text-xs text-slate-400">{job.venue_city}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-300">{job.clients?.company_name || 'Private'}</p>
                        <p className="text-xs text-slate-400">{job.clients?.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{job.agreed_amount ? `£${Number(job.agreed_amount).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{job.platform_fee ? `£${Number(job.platform_fee).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{job.guard_payout_amount ? `£${Number(job.guard_payout_amount).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${psc.bg} ${psc.text} ring-1 ${psc.border}`}>
                          <div className="w-3 h-3 flex items-center justify-center"><i className={`${psc.icon} text-[10px]`}></i></div>
                          {psc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {job.payment_status === 'funded' && (
                            <button onClick={() => updatePaymentStatus(job.id, 'released', 'Admin manually released')}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold hover:bg-teal-500/20 transition-colors ring-1 ring-teal-500/20 whitespace-nowrap cursor-pointer disabled:opacity-50">
                              {isBusy ? '...' : 'Release to Guard'}
                            </button>
                          )}
                          {job.payment_status === 'funded' && (
                            <button onClick={() => updatePaymentStatus(job.id, 'disputed', 'Admin flagged as disputed')}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors ring-1 ring-orange-500/20 whitespace-nowrap cursor-pointer disabled:opacity-50">
                              {isBusy ? '...' : 'Flag Dispute'}
                            </button>
                          )}
                          {job.payment_status === 'disputed' && (
                            <button onClick={() => updatePaymentStatus(job.id, 'funded', 'Admin resolved dispute')}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20 whitespace-nowrap cursor-pointer disabled:opacity-50">
                              {isBusy ? '...' : 'Resolve'}
                            </button>
                          )}
                          <Link href={`/jobs/${job.id}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2642] text-slate-500 hover:text-slate-300 transition-all cursor-pointer">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-external-link-line text-sm"></i></div>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-24 right-6 z-50 shadow-lg px-5 py-3 rounded-xl flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <i className={`text-lg ${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}