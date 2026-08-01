'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';

interface DisputeRow {
  id: string;
  job_id: string;
  client_id: string;
  guard_id: string;
  raised_by: string;
  reason: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  resolution: string | null;
  refund_amount: number | null;
  admin_decided_by: string | null;
  stripe_refund_id: string | null;
  stripe_transfer_id: string | null;
  created_at: string;
  resolved_at: string | null;
  jobs: { job_title: string; venue_city: string; agreed_amount: number | null; currency: string | null } | null;
  guards: { full_name: string | null; email: string | null } | null;
  clients: { company_name: string | null; email: string | null } | null;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  under_review: { label: 'Under Review', bg: 'bg-sky-500/10', text: 'text-sky-400' },
  resolved_guard: { label: 'Guard Paid', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  resolved_client_refund: { label: 'Full Refund', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  resolved_client_partial: { label: 'Partial Refund', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  resolved_cancelled: { label: 'Cancelled', bg: 'bg-slate-500/10', text: 'text-slate-300' },
};

export default function DisputeAdminPanel() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [resolving, setResolving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [evidenceView, setEvidenceView] = useState<string | null>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          jobs:job_id (job_title, venue_city, agreed_amount, currency),
          guards:guard_id (full_name, email),
          clients:client_id (company_name, email)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDisputes(data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load disputes', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleResolve = async (resolution: string) => {
    if (!selected) return;
    setResolving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            dispute_id: selected.id,
            resolution,
            refund_amount: parseFloat(refundAmount || '0'),
            admin_notes: adminNotes,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve dispute');

      await logAdminAction({
        actionType: 'dispute_resolved',
        actionDescription: `Resolved dispute ${selected.id} with outcome: ${resolution}`,
        targetType: 'dispute',
        targetName: selected.id,
      });

      setToast({ message: 'Dispute resolved successfully', type: 'success' });
      setSelected(null);
      setAdminNotes('');
      setRefundAmount('');
      await loadDisputes();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to resolve dispute', type: 'error' });
    } finally {
      setResolving(false);
    }
  };

  const handleOpenDispute = async (jobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dispute-job`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            job_id: jobId,
            reason: 'Admin opened dispute',
            raised_by: 'admin',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open dispute');

      await logAdminAction({
        actionType: 'dispute_opened',
        actionDescription: `Admin opened dispute for job ${jobId}`,
        targetType: 'job',
        targetName: jobId,
      });

      setToast({ message: 'Dispute opened successfully', type: 'success' });
      await loadDisputes();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to open dispute', type: 'error' });
    }
  };

  const handleCloseDispute = async (disputeId: string) => {
    try {
      const { error } = await supabase
        .from('disputes')
        .update({ status: 'resolved_cancelled', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', disputeId);
      if (error) throw error;

      await logAdminAction({
        actionType: 'dispute_closed',
        actionDescription: `Admin closed dispute ${disputeId}`,
        targetType: 'dispute',
        targetName: disputeId,
      });

      setToast({ message: 'Dispute closed', type: 'success' });
      await loadDisputes();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to close dispute', type: 'error' });
    }
  };

  const filtered = disputes.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'open') return d.status === 'open' || d.status === 'under_review';
    if (filter === 'resolved') return d.status.startsWith('resolved_');
    return d.status === filter;
  });

  const counts = {
    all: disputes.length,
    open: disputes.filter(d => d.status === 'open' || d.status === 'under_review').length,
    under_review: disputes.filter(d => d.status === 'under_review').length,
    resolved: disputes.filter(d => d.status.startsWith('resolved_')).length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-white">Disputes</h3>
          <p className="text-sm text-slate-400">Client disputes and admin resolution actions</p>
        </div>
        <button
          onClick={loadDisputes}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line text-sm"></i>
          </div>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { key: 'all', label: 'All', count: counts.all, color: 'text-slate-300 bg-[#1a2b4a] ring-[#1e3048]' },
          { key: 'open', label: 'Open', count: counts.open, color: 'text-amber-400 bg-amber-500/10 ring-amber-500/20' },
          { key: 'under_review', label: 'Under Review', count: counts.under_review, color: 'text-sky-400 bg-sky-500/10 ring-sky-500/20' },
          { key: 'resolved', label: 'Resolved', count: counts.resolved, color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl ring-1 px-2 py-2 text-center transition-all cursor-pointer ${s.color} ${filter === s.key ? 'ring-2 shadow-sm' : ''}`}
          >
            <p className="text-lg font-extrabold">{s.count}</p>
            <p className="text-[10px] font-semibold mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading disputes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-12 h-12 bg-[#1a2b4a] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e3048]">
            <i className="ri-shield-check-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400">No {filter !== 'all' ? filter : ''} disputes found</p>
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
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Raised</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dispute) => {
                  const sc = statusConfig[dispute.status] || statusConfig.open;
                  return (
                    <tr key={dispute.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{dispute.jobs?.job_title || '—'}</p>
                        <p className="text-xs text-slate-500">{dispute.jobs?.venue_city || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-300">{dispute.clients?.company_name || 'Private'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-300">{dispute.guards?.full_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                        {dispute.reason}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {dispute.jobs?.agreed_amount ? `£${Number(dispute.jobs.agreed_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} ring-1 ring-slate-500/20`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(dispute.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {(dispute.status === 'open' || dispute.status === 'under_review') && (
                            <button
                              onClick={() => { setSelected(dispute); setAdminNotes(dispute.admin_notes || ''); setRefundAmount(dispute.refund_amount ? String(dispute.refund_amount) : ''); }}
                              className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold hover:bg-teal-500/20 ring-1 ring-teal-500/20 whitespace-nowrap transition-all cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleCloseDispute(dispute.id)}
                            disabled={dispute.status.startsWith('resolved_')}
                            className="px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-300 text-xs font-bold hover:bg-slate-500/20 ring-1 ring-slate-500/20 whitespace-nowrap disabled:opacity-50 transition-all cursor-pointer"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => setEvidenceView(dispute.details || 'No details provided')}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e3048] text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="View details"
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-file-text-line text-sm"></i>
                            </div>
                          </button>
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

      {/* Resolve Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl ring-1 ring-[#1a2b4a] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Resolve Dispute</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-[#1a2b4a] rounded-xl p-4 ring-1 ring-[#1e3048]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center">
                    <i className="ri-briefcase-line text-teal-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selected.jobs?.job_title}</p>
                    <p className="text-xs text-slate-500">{selected.jobs?.venue_city}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-400 mt-3">
                  <div className="flex items-center gap-2"><i className="ri-building-line"></i> {selected.clients?.company_name || 'Private'}</div>
                  <div className="flex items-center gap-2"><i className="ri-user-line"></i> {selected.guards?.full_name || '—'}</div>
                  <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line"></i> £{(selected.jobs?.agreed_amount || 0).toFixed(2)}</div>
                  <div className="flex items-center gap-2"><i className="ri-calendar-line"></i> {new Date(selected.created_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-300 mb-1">Dispute Reason</p>
                <p className="text-sm text-slate-400 bg-[#1a2b4a] rounded-lg p-3 border border-[#1e3048]">{selected.reason}</p>
              </div>

              {selected.details && (
                <div>
                  <p className="text-sm font-bold text-slate-300 mb-1">Guard Response / Details</p>
                  <p className="text-sm text-slate-400 bg-[#1a2b4a] rounded-lg p-3 border border-[#1e3048]">{selected.details}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Document your decision rationale..."
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-slate-200 bg-[#1a2b4a]/50 resize-none h-24"
                />
                <p className="text-xs text-slate-500 mt-1">{adminNotes.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Refund Amount (if applicable)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-40 px-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-semibold text-slate-200 bg-[#1a2b4a]/50"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResolve('resolved_guard')}
                disabled={resolving}
                className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-check-line"></i>Release to Guard
              </button>
              <button
                onClick={() => handleResolve('resolved_client_refund')}
                disabled={resolving}
                className="px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-refund-line"></i>Full Refund
              </button>
              <button
                onClick={() => handleResolve('resolved_client_partial')}
                disabled={resolving}
                className="px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-refund-line"></i>Partial Refund
              </button>
              <button
                onClick={() => handleResolve('resolved_cancelled')}
                disabled={resolving}
                className="px-4 py-3 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-close-line"></i>Keep on Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence View Modal */}
      {evidenceView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-6 shadow-xl ring-1 ring-[#1a2b4a]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Dispute Details</h3>
              <button onClick={() => setEvidenceView(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed bg-[#1a2b4a] rounded-xl p-4 border border-[#1e3048]">{evidenceView}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setEvidenceView(null)} className="px-4 py-2 bg-[#1a2b4a] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e3048] transition-all cursor-pointer">Close</button>
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