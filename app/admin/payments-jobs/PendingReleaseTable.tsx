'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';

interface PendingReleaseRow {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  requested_at: string;
  dispute_reason: string | null;
  notes: string | null;
  jobs: { job_title: string; venue_city: string; agreed_amount: number | null; payment_status: string | null; completion_status: string | null } | null;
  guards: { full_name: string | null; email: string | null; stripe_account_id?: string | null } | null;
  clients: { company_name: string | null; email: string | null } | null;
}

interface PayoutCheckResult {
  clientPaymentCompleted: boolean;
  jobCompleted: boolean;
  clientConfirmedCompletion: boolean;
  guardHasStripeConnect: boolean;
  payoutAlreadyPaid: boolean;
  existingPayoutStatus: string | null;
  existingTransferId: string | null;
}

export default function PendingReleaseTable() {
  const [requests, setRequests] = useState<PendingReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PendingReleaseRow | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [payoutChecks, setPayoutChecks] = useState<PayoutCheckResult | null>(null);
  const [checkingPayout, setCheckingPayout] = useState(false);
  const [failedPayouts, setFailedPayouts] = useState<any[]>([]);
  const [showFailedPayouts, setShowFailedPayouts] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_completion_requests')
        .select(`
          id, job_id, guard_id, status, requested_at, dispute_reason, notes,
          jobs:job_id (job_title, venue_city, agreed_amount, payment_status, completion_status, client_id),
          guards:guard_id (full_name, email, stripe_account_id)
        `)
        .order('requested_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const clientIds = (data || []).map((r: any) => r.jobs?.client_id).filter(Boolean);
      let clientMap: Record<string, any> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, company_name, email')
          .in('id', clientIds);
        (clients || []).forEach((c: any) => { clientMap[c.id] = c; });
      }

      const enriched = (data || []).map((r: any) => ({
        ...r,
        clients: clientMap[r.jobs?.client_id] || null,
      }));

      setRequests(enriched as PendingReleaseRow[]);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const checkPayoutEligibility = async (requestId: string, jobId: string, guardId: string) => {
    setCheckingPayout(true);
    setPayoutChecks(null);
    try {
      const { data: transaction } = await supabase
        .from('transactions')
        .select('status')
        .eq('job_id', jobId)
        .eq('status', 'completed')
        .maybeSingle();

      const { data: job } = await supabase
        .from('jobs')
        .select('completion_status')
        .eq('id', jobId)
        .maybeSingle();

      const { data: guard } = await supabase
        .from('guards')
        .select('stripe_account_id')
        .eq('id', guardId)
        .maybeSingle();

      const { data: existingPayout } = await supabase
        .from('guard_payouts')
        .select('id, status, stripe_transfer_id')
        .eq('job_id', jobId)
        .eq('guard_id', guardId)
        .maybeSingle();

      const result: PayoutCheckResult = {
        clientPaymentCompleted: !!transaction,
        jobCompleted: !!job,
        clientConfirmedCompletion: job?.completion_status === 'confirmed_by_client' || job?.completion_status === 'completed',
        guardHasStripeConnect: !!guard?.stripe_account_id,
        payoutAlreadyPaid: existingPayout?.status === 'completed' || existingPayout?.status === 'paid_out' || existingPayout?.status === 'processing',
        existingPayoutStatus: existingPayout?.status || null,
        existingTransferId: existingPayout?.stripe_transfer_id || null,
      };

      setPayoutChecks(result);
    } catch (err: any) {
      setToast({ message: 'Failed to check payout eligibility', type: 'error' });
    } finally {
      setCheckingPayout(false);
    }
  };

  const handleApprovePayout = async (requestId: string, jobId: string, guardId: string, amount: number, guardName: string, guardEmail: string, jobTitle: string) => {
    setProcessingId(requestId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || '';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/release-guard-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guardId,
            jobId,
            amount,
            jobTitle,
            guardEmail,
            guardName,
            adminNotes,
            completionRequestId: requestId,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to release payment');

      await logAdminAction({
        actionType: 'guard_payout_approved',
        actionDescription: `Admin approved Stripe payout for guard ${guardName} on job ${jobTitle}. Transfer ID: ${data.transferId}`,
        targetType: 'guard_payout',
        targetName: `${jobId}/${guardId}`,
      });

      setToast({ message: `Payout sent! £${data.netAmount} to ${guardName}. Transfer ID: ${data.transferId}`, type: 'success' });
      setSelectedRequest(null);
      setAdminNotes('');
      setPayoutChecks(null);
      await loadRequests();
      await loadFailedPayouts();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to release payment', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleHoldPayout = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase
        .from('job_completion_requests')
        .update({ status: 'on_hold', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      await logAdminAction({
        actionType: 'payout_on_hold',
        actionDescription: `Admin placed payout on hold for completion request ${requestId}`,
        targetType: 'job_completion_request',
        targetName: requestId,
      });

      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'on_hold' } : r));
      setSelectedRequest(null);
      setAdminNotes('');
      setPayoutChecks(null);
      setToast({ message: 'Payout placed on hold', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to hold payout', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const loadFailedPayouts = async () => {
    try {
      const { data } = await supabase
        .from('guard_payouts')
        .select('id, job_id, guard_id, amount, net_amount, status, failure_reason, created_at, stripe_transfer_id, stripe_transfer_status')
        .or('status.eq.failed,stripe_transfer_status.eq.failed')
        .order('created_at', { ascending: false })
        .limit(50);

      const guardIds = (data || []).map((p: any) => p.guard_id).filter(Boolean);
      let guardMap: Record<string, any> = {};
      if (guardIds.length > 0) {
        const { data: guards } = await supabase.from('guards').select('id, full_name, email').in('id', guardIds);
        (guards || []).forEach((g: any) => { guardMap[g.id] = g; });
      }

      const enriched = (data || []).map((p: any) => ({ ...p, guards: guardMap[p.guard_id] || null }));
      setFailedPayouts(enriched);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadRequests();
    loadFailedPayouts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'awaiting_client') return r.status === 'pending' && !r.dispute_reason;
    if (filter === 'disputed') return r.status === 'disputed' || !!r.dispute_reason;
    return r.status === filter;
  });

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    awaiting_client: requests.filter(r => r.status === 'pending' && !r.dispute_reason).length,
    disputed: requests.filter(r => r.status === 'disputed' || !!r.dispute_reason).length,
    approved: requests.filter(r => r.status === 'approved').length,
  };

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
    disputed: 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
    rejected: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-white">Pending Release</h3>
          <p className="text-sm text-slate-400">Jobs marked complete by guards waiting for approval</p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line text-sm"></i>
          </div>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {[
          { key: 'all', label: 'All', count: counts.all, color: 'text-slate-300 bg-[#1a2b4a] ring-[#1e3048]' },
          { key: 'pending', label: 'Pending', count: counts.pending, color: 'text-amber-400 bg-amber-500/10 ring-amber-500/20' },
          { key: 'awaiting_client', label: 'Awaiting Client', count: counts.awaiting_client, color: 'text-sky-400 bg-sky-500/10 ring-sky-500/20' },
          { key: 'disputed', label: 'Disputed', count: counts.disputed, color: 'text-orange-400 bg-orange-500/10 ring-orange-500/20' },
          { key: 'approved', label: 'Approved', count: counts.approved, color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
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
          <p className="text-sm text-slate-400">Loading requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-12 h-12 bg-[#1a2b4a] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1e3048]">
            <i className="ri-checkbox-circle-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400">No {filter !== 'all' ? filter : ''} requests found</p>
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2b4a] border-b border-[#1e3048]">
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Guard</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Requested</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Dispute</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{req.guards?.full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{req.guards?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{req.jobs?.job_title || '—'}</p>
                      <p className="text-xs text-slate-500">{req.jobs?.venue_city || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-300">{req.clients?.company_name || 'Private'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      {req.jobs?.agreed_amount ? `£${Number(req.jobs.agreed_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles[req.status] || 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">
                      {req.dispute_reason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              checkPayoutEligibility(req.id, req.job_id, req.guard_id);
                            }}
                            disabled={processingId === req.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 ring-1 ring-emerald-500/20 whitespace-nowrap disabled:opacity-50 transition-all cursor-pointer"
                          >
                            Approve Stripe Payout
                          </button>
                        )}
                        {req.status === 'disputed' && (
                          <button
                            onClick={() => {
                              supabase
                                .from('job_completion_requests')
                                .update({ status: 'pending', updated_at: new Date().toISOString() })
                                .eq('id', req.id)
                                .then(() => {
                                  setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'pending' } : r));
                                  setToast({ message: 'Dispute cleared', type: 'success' });
                                })
                                .catch((err: any) => setToast({ message: err.message, type: 'error' }));
                            }}
                            disabled={processingId === req.id}
                            className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-bold hover:bg-sky-500/20 ring-1 ring-sky-500/20 whitespace-nowrap disabled:opacity-50 transition-all cursor-pointer"
                          >
                            Clear Dispute
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Payout Approval Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-6 shadow-xl ring-1 ring-[#1a2b4a] max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <div className="w-14 h-14 flex items-center justify-center bg-emerald-500/10 rounded-2xl mx-auto mb-4 ring-1 ring-emerald-500/20">
                <i className="ri-bank-card-line text-2xl text-emerald-400"></i>
              </div>
              <h3 className="text-xl font-extrabold text-white mb-1">Approve Stripe Payout</h3>
              <p className="text-sm text-slate-400">Send payment to guard's connected bank account</p>
            </div>

            <div className="bg-[#1a2b4a] rounded-xl p-4 mb-4 ring-1 ring-[#1e3048]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-briefcase-line text-teal-400"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{selectedRequest.jobs?.job_title}</p>
                  <p className="text-xs text-slate-500">{selectedRequest.jobs?.venue_city}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-400 mt-3">
                <div className="flex items-center gap-2"><i className="ri-user-line"></i> {selectedRequest.guards?.full_name}</div>
                <div className="flex items-center gap-2"><i className="ri-building-line"></i> {selectedRequest.clients?.company_name || 'Private'}</div>
                <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line"></i> £{(selectedRequest.jobs?.agreed_amount || 0).toFixed(2)}</div>
                <div className="flex items-center gap-2"><i className="ri-calendar-line"></i> {new Date(selectedRequest.requested_at).toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {checkingPayout ? (
              <div className="bg-[#1a2b4a] rounded-xl p-4 mb-4 text-center ring-1 ring-[#1e3048]">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-slate-400">Checking payout eligibility...</p>
              </div>
            ) : payoutChecks ? (
              <div className="bg-[#1a2b4a] rounded-xl p-4 mb-4 ring-1 ring-[#1e3048] space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Eligibility Checks</p>
                {[
                  { label: 'Client payment completed', pass: payoutChecks.clientPaymentCompleted },
                  { label: 'Job completed', pass: payoutChecks.jobCompleted },
                  { label: 'Client confirmed completion', pass: payoutChecks.clientConfirmedCompletion },
                  { label: 'Guard has Stripe Connect', pass: payoutChecks.guardHasStripeConnect },
                  { label: 'Not already paid out', pass: !payoutChecks.payoutAlreadyPaid },
                ].map((check, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {check.pass ? (
                      <i className="ri-checkbox-circle-fill text-emerald-400 text-sm"></i>
                    ) : (
                      <i className="ri-close-circle-fill text-red-400 text-sm"></i>
                    )}
                    <span className={`text-xs ${check.pass ? 'text-emerald-400' : 'text-red-400'}`}>{check.label}</span>
                    {!check.pass && check.label === 'Not already paid out' && payoutChecks.existingPayoutStatus && (
                      <span className="text-[10px] text-red-500 ml-auto">Status: {payoutChecks.existingPayoutStatus}{payoutChecks.existingTransferId ? ` (${payoutChecks.existingTransferId.slice(0, 12)}...)` : ''}</span>
                    )}
                  </div>
                ))}
                {payoutChecks.payoutAlreadyPaid && (
                  <p className="text-xs text-red-400 font-bold mt-2 bg-red-500/10 p-2 rounded-lg">This guard has already been paid for this job. Payout blocked.</p>
                )}
              </div>
            ) : null}

            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-300 mb-2">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Reason for approval..."
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-slate-200 bg-[#1a2b4a]/50 resize-none h-24"
              />
              <p className="text-xs text-slate-500 mt-1">{adminNotes.length}/500</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedRequest(null); setAdminNotes(''); setPayoutChecks(null); }}
                disabled={processingId === selectedRequest.id}
                className="flex-1 px-4 py-3 bg-[#1a2b4a] text-slate-300 rounded-xl text-sm font-bold hover:bg-[#1e3048] transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleHoldPayout(selectedRequest.id)}
                disabled={processingId === selectedRequest.id}
                className="px-4 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                <i className="ri-pause-circle-line mr-1.5"></i>Hold
              </button>
              <button
                onClick={() => handleApprovePayout(selectedRequest.id, selectedRequest.job_id, selectedRequest.guard_id, selectedRequest.jobs?.agreed_amount || 0, selectedRequest.guards?.full_name || '', selectedRequest.guards?.email || '', selectedRequest.jobs?.job_title || '')}
                disabled={processingId === selectedRequest.id || (payoutChecks ? (!payoutChecks.clientPaymentCompleted || !payoutChecks.clientConfirmedCompletion || !payoutChecks.guardHasStripeConnect || payoutChecks.payoutAlreadyPaid) : false)}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-500/20 whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {processingId === selectedRequest.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line"></i>
                    Approve Stripe Payout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failed Payouts Section */}
      {failedPayouts.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowFailedPayouts(!showFailedPayouts)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 ring-1 ring-red-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <i className={`ri-error-warning-line ${showFailedPayouts ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
            Failed Payouts ({failedPayouts.length})
          </button>
          {showFailedPayouts && (
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden mt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-500/10 border-b border-red-500/20">
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Guard</th>
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Job ID</th>
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 text-left font-bold text-red-400 text-xs uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedPayouts.map((fp: any) => (
                      <tr key={fp.id} className="border-b border-[#1a2b4a]/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{fp.guards?.full_name || '—'}</p>
                          <p className="text-xs text-slate-500">{fp.guards?.email || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{fp.job_id?.slice(0, 8)}...</td>
                        <td className="px-4 py-3 font-bold text-white">£{Number(fp.net_amount || fp.amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                            {fp.stripe_transfer_status || fp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">{fp.failure_reason || 'Unknown error'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {fp.created_at ? new Date(fp.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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