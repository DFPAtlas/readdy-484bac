'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';

interface PaymentJobRow {
  id: string;
  job_title: string;
  venue_city: string;
  start_date: string;
  agreed_amount: number | null;
  platform_fee: number | null;
  guard_payout_amount: number | null;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  status: string;
  clients: { company_name: string | null; email: string | null; contact_name: string | null } | null;
  guards: { full_name: string | null }[] | null;
}

const paymentStatusConfig: Record<string, { label: string; bg: string; text: string; ring: string; icon: string }> = {
  unpaid: { label: 'Unpaid', bg: 'bg-slate-500/10', text: 'text-slate-300', ring: 'ring-slate-500/20', icon: 'ri-money-pound-circle-line' },
  payment_pending: { label: 'Awaiting Payment', bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', icon: 'ri-time-line' },
  funded: { label: 'Funded', bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', icon: 'ri-shield-check-line' },
  completed: { label: 'Completed', bg: 'bg-teal-500/10', text: 'text-teal-400', ring: 'ring-teal-500/20', icon: 'ri-checkbox-circle-line' },
  disputed: { label: 'Disputed', bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20', icon: 'ri-alert-line' },
  released: { label: 'Released', bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20', icon: 'ri-send-plane-line' },
  refunded: { label: 'Refunded', bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20', icon: 'ri-refund-line' },
};

export default function PaymentOverviewTable() {
  const [jobs, setJobs] = useState<PaymentJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<PaymentJobRow | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          id, job_title, venue_city, start_date, agreed_amount,
          platform_fee, guard_payout_amount, payment_status,
          stripe_payment_intent_id, created_at, status,
          clients:client_id (company_name, email, contact_name)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const jobIds = (jobsData || []).map((j: any) => j.id);
      let guardMap: Record<string, { full_name: string | null }[]> = {};

      if (jobIds.length > 0) {
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id, guard_id')
          .in('job_id', jobIds);

        const guardIds = (assignments || []).map((a: any) => a.guard_id).filter(Boolean);
        let guardNameMap: Record<string, string | null> = {};
        if (guardIds.length > 0) {
          const { data: guards } = await supabase
            .from('guards')
            .select('id, full_name')
            .in('id', guardIds);
          (guards || []).forEach((g: any) => { guardNameMap[g.id] = g.full_name; });
        }

        (assignments || []).forEach((a: any) => {
          if (!guardMap[a.job_id]) guardMap[a.job_id] = [];
          guardMap[a.job_id].push({ full_name: guardNameMap[a.guard_id] || null });
        });
      }

      const enriched = (jobsData || []).map((j: any) => ({
        ...j,
        guards: guardMap[j.id] || [],
      }));

      setJobs(enriched as PaymentJobRow[]);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load jobs', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    setProcessingId(jobId);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId);
      if (error) throw error;

      await logAdminAction({
        actionType: 'payment_status_change',
        actionDescription: `Changed payment status to ${newStatus} for job ${jobId}`,
        targetType: 'job',
        targetName: jobId,
      });

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, payment_status: newStatus } : j));
      setToast({ message: `Status updated to ${newStatus}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update status', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Job Title', 'Client', 'Guard', 'Agreed Amount', 'Platform Fee', 'Guard Payout', 'Payment Status', 'Stripe PaymentIntent ID', 'Created Date'];
    const rows = filteredJobs.map(j => [
      j.job_title,
      j.clients?.company_name || j.clients?.contact_name || 'Private',
      j.guards?.map(g => g.full_name).filter(Boolean).join(', ') || '—',
      j.agreed_amount ? `£${Number(j.agreed_amount).toFixed(2)}` : '—',
      j.platform_fee ? `£${Number(j.platform_fee).toFixed(2)}` : '—',
      j.guard_payout_amount ? `£${Number(j.guard_payout_amount).toFixed(2)}` : '—',
      j.payment_status || 'unpaid',
      j.stripe_payment_intent_id || '—',
      new Date(j.created_at).toLocaleDateString('en-GB'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesFilter = filter === 'all' || j.payment_status === filter;
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      j.job_title?.toLowerCase().includes(q) ||
      j.clients?.company_name?.toLowerCase().includes(q) ||
      j.clients?.contact_name?.toLowerCase().includes(q) ||
      j.venue_city?.toLowerCase().includes(q) ||
      j.guards?.some(g => g.full_name?.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const statusCounts = {
    all: jobs.length,
    unpaid: jobs.filter(j => j.payment_status === 'unpaid' || !j.payment_status).length,
    payment_pending: jobs.filter(j => j.payment_status === 'payment_pending').length,
    funded: jobs.filter(j => j.payment_status === 'funded').length,
    completed: jobs.filter(j => j.payment_status === 'completed').length,
    disputed: jobs.filter(j => j.payment_status === 'disputed').length,
    released: jobs.filter(j => j.payment_status === 'released').length,
    refunded: jobs.filter(j => j.payment_status === 'refunded').length,
  };

  const statusFilters = [
    { key: 'all', label: 'All', count: statusCounts.all, color: 'text-slate-300 bg-[#1a2b4a] ring-[#1e3048]' },
    { key: 'unpaid', label: 'Unpaid', count: statusCounts.unpaid, color: 'text-slate-300 bg-slate-500/10 ring-slate-500/20' },
    { key: 'payment_pending', label: 'Awaiting', count: statusCounts.payment_pending, color: 'text-amber-400 bg-amber-500/10 ring-amber-500/20' },
    { key: 'funded', label: 'Funded', count: statusCounts.funded, color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
    { key: 'completed', label: 'Completed', count: statusCounts.completed, color: 'text-teal-400 bg-teal-500/10 ring-teal-500/20' },
    { key: 'disputed', label: 'Disputed', count: statusCounts.disputed, color: 'text-orange-400 bg-orange-500/10 ring-orange-500/20' },
    { key: 'released', label: 'Released', count: statusCounts.released, color: 'text-blue-400 bg-blue-500/10 ring-blue-500/20' },
    { key: 'refunded', label: 'Refunded', count: statusCounts.refunded, color: 'text-rose-400 bg-rose-500/10 ring-rose-500/20' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-white">Payment Overview</h3>
          <p className="text-sm text-slate-400">All jobs with payment details</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredJobs.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2b4a] border border-[#1e3048] text-sm font-medium text-slate-300 hover:bg-[#1e3048] transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-download-line text-sm"></i>
            </div>
            Export CSV
          </button>
          <button
            onClick={loadJobs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
              <i className="ri-refresh-line text-sm"></i>
            </div>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
        {statusFilters.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl ring-1 px-2 py-2 text-center transition-all ${s.color} ${filter === s.key ? 'ring-2 shadow-sm' : ''}`}
          >
            <p className="text-lg font-extrabold">{s.count}</p>
            <p className="text-[10px] font-semibold mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <i className="ri-search-line text-lg"></i>
        </div>
        <input
          type="text"
          placeholder="Search jobs, clients, or guards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-slate-200 placeholder:text-slate-500 bg-[#1a2b4a]/50 transition-all"
        />
      </div>

      {loading ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading payment data...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-12 h-12 bg-[#1a2b4a] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e3048]">
            <i className="ri-secure-payment-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400">No jobs match this filter</p>
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2b4a] border-b border-[#1e3048]">
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Guard</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Agreed</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Platform Fee</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Guard Payout</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Stripe ID</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const psc = job.payment_status ? (paymentStatusConfig[job.payment_status] || paymentStatusConfig.unpaid) : paymentStatusConfig.unpaid;
                  const guardNames = job.guards?.map(g => g.full_name).filter(Boolean).join(', ') || '—';
                  return (
                    <tr key={job.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{job.job_title}</p>
                        <p className="text-xs text-slate-500">{job.venue_city}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-300">{job.clients?.company_name || job.clients?.contact_name || 'Private'}</p>
                        <p className="text-xs text-slate-500">{job.clients?.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[140px] truncate">
                        {guardNames}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {job.agreed_amount ? `£${Number(job.agreed_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {job.platform_fee ? `£${Number(job.platform_fee).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {job.guard_payout_amount ? `£${Number(job.guard_payout_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${psc.bg} ${psc.text} ring-1 ${psc.ring}`}>
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className={`${psc.icon} text-[10px]`}></i>
                          </div>
                          {psc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono max-w-[120px] truncate">
                        {job.stripe_payment_intent_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e3048] text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="View details"
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-eye-line text-sm"></i>
                            </div>
                          </button>
                          <div className="relative group">
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e3048] text-slate-400 hover:text-white transition-all cursor-pointer">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <i className="ri-more-2-fill text-sm"></i>
                              </div>
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-20 bg-[#111d35] border border-[#1e3048] rounded-xl shadow-lg overflow-hidden w-44">
                              <button
                                onClick={() => handleStatusChange(job.id, 'under_review')}
                                disabled={processingId === job.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Mark Under Review
                              </button>
                              <button
                                onClick={() => handleStatusChange(job.id, 'released')}
                                disabled={processingId === job.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-teal-400 hover:bg-teal-500/10 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Approve Release
                              </button>
                              <button
                                onClick={() => handleStatusChange(job.id, 'refunded')}
                                disabled={processingId === job.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Issue Refund
                              </button>
                              <button
                                onClick={() => handleStatusChange(job.id, 'disputed')}
                                disabled={processingId === job.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Open Dispute
                              </button>
                              <button
                                onClick={() => handleStatusChange(job.id, 'funded')}
                                disabled={processingId === job.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Mark Funded
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#1a2b4a] text-xs text-slate-500 font-medium">
            {filteredJobs.length} jobs shown
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-6 shadow-xl ring-1 ring-[#1a2b4a]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">Payment Details</h3>
              <button onClick={() => setSelectedJob(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition-all cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Job</span>
                <span className="text-sm font-bold text-white">{selectedJob.job_title}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Client</span>
                <span className="text-sm font-bold text-white">{selectedJob.clients?.company_name || selectedJob.clients?.contact_name || 'Private'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Guards</span>
                <span className="text-sm font-bold text-white">{selectedJob.guards?.map(g => g.full_name).filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Agreed Amount</span>
                <span className="text-sm font-bold text-white">{selectedJob.agreed_amount ? `£${Number(selectedJob.agreed_amount).toFixed(2)}` : '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Platform Fee</span>
                <span className="text-sm font-bold text-white">{selectedJob.platform_fee ? `£${Number(selectedJob.platform_fee).toFixed(2)}` : '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Guard Payout</span>
                <span className="text-sm font-bold text-white">{selectedJob.guard_payout_amount ? `£${Number(selectedJob.guard_payout_amount).toFixed(2)}` : '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Payment Status</span>
                <span className="text-sm font-bold text-white capitalize">{selectedJob.payment_status || 'unpaid'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a2b4a]">
                <span className="text-sm text-slate-400">Stripe PaymentIntent</span>
                <span className="text-sm font-mono text-slate-300">{selectedJob.stripe_payment_intent_id || '—'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-slate-400">Created</span>
                <span className="text-sm font-bold text-white">{new Date(selectedJob.created_at).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSelectedJob(null)} className="flex-1 px-4 py-2.5 bg-[#1a2b4a] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e3048] transition-all whitespace-nowrap cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
          <i className={`text-lg ${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}