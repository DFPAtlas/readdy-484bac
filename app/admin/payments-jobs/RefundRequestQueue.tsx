'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RefundRequest = {
  id: string; job_id: string; requested_amount: number; status: string;
  reason: string; notes: string | null; created_at: string; type: string;
  jobs: { job_title: string; status: string } | null;
  clients: { company_name: string } | null;
  job_cancellations: { preferred_resolution: string } | null;
};
const currency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(amount));

export default function RefundRequestQueue() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<RefundRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedJobs, setBlockedJobs] = useState<Set<string>>(new Set());
  const submitting = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Sign in to view refund requests.');
      const { data: admin, error: roleError } = await supabase.from('admin_users').select('role,is_active').eq('user_id', user.id).maybeSingle();
      if (roleError || !admin?.is_active || !['super_admin', 'finance_admin'].includes(admin.role)) {
        setAuthorized(false); setRequests([]); return;
      }
      setAuthorized(true);
      const [queue, operations] = await Promise.all([
        supabase.from('refund_requests').select('id,job_id,requested_amount,status,reason,notes,created_at,type,jobs(job_title,status),clients(company_name),job_cancellations(preferred_resolution)').in('status', ['pending', 'approved', 'processing']).order('created_at', { ascending: true }),
        supabase.from('financial_operations').select('job_id').in('state', ['processing', 'reconciliation_required']),
      ]);
      if (queue.error || operations.error) throw new Error(queue.error?.message || operations.error?.message || 'Unable to load refunds');
      setRequests((queue.data || []) as unknown as RefundRequest[]);
      setBlockedJobs(new Set((operations.data || []).map(op => op.job_id)));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load refund requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const process = async () => {
    if (!selected || submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    const request = selected;
    try {
      const { data: assurance, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaError || assurance?.currentLevel !== 'aal2') throw new Error('Complete admin MFA sign-in before processing a refund.');
      // Block another click even if the response is lost after Stripe accepts the refund.
      setBlockedJobs(previous => new Set(previous).add(request.job_id));
      const { data, error: invokeError } = await supabase.functions.invoke('execute-job-refund', { body: { jobId: request.job_id, refundRequestId: request.id } });
      if (invokeError) {
        let detail = invokeError.message;
        try { const context = (invokeError as { context?: Response }).context; if (context) detail = (await context.json()).error || detail; } catch { /* Retain original error. */ }
        throw new Error(detail + ' Refresh the queue to check its state before retrying.');
      }
      if (!data?.success || !['succeeded', 'pending'].includes(data.status)) throw new Error(data?.error || 'Refund outcome unknown. Finance reconciliation is required before retrying.');
      setMessage(data.status === 'succeeded' ? `${currency(data.refundAmount)} refund completed. Stripe reference: ${data.refundId}.` : `${currency(data.refundAmount)} submitted to Stripe and pending. Do not submit again.`);
      setSelected(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Refund failed. Check its state before retrying.'); }
    finally { submitting.current = false; setBusy(false); }
  };

  return <section className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 space-y-4" aria-label="Refund requests">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Refund Requests</h2><p className="text-sm text-slate-400">Requested refunds are separate from money already refunded.</p></div><button disabled={busy || loading} onClick={() => void load()} className="text-teal-400 disabled:opacity-50">Refresh queue</button></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {message && <p role="status" className="text-teal-300">{message}</p>}
    {loading ? <p className="text-slate-400">Loading refund requests…</p> : !authorized ? <p className="text-slate-400">Finance Admin or Super Admin access required.</p> : <>
      {!requests.length && !error && <p className="text-slate-400">No pending refund requests.</p>}
      <div className="space-y-3">{requests.map(request => {
        const blocked = blockedJobs.has(request.job_id) || request.status === 'processing';
        const canProcess = !blocked && ['pending', 'approved'].includes(request.status) && request.type === 'full' && request.jobs?.status === 'cancelled' && request.job_cancellations?.preferred_resolution === 'full_refund';
        return <article key={request.id} className="rounded-xl border border-[#1a2b4a] p-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-white">{request.jobs?.job_title || request.job_id}</h3><span className="font-bold text-white">{currency(request.requested_amount)} requested</span></div>
          <p className="text-sm text-slate-400">{request.clients?.company_name || 'Client'} · {request.status} · {new Date(request.created_at).toLocaleString('en-GB')}</p>
          <p className="text-sm text-slate-300">Reason: {request.reason}</p>
          {request.notes && <p className="text-sm text-slate-400 whitespace-pre-wrap">{request.notes}</p>}
          {blocked ? <p className="text-amber-300 text-sm">Processing or reconciliation required. Do not submit again.</p> : canProcess ? <button disabled={busy || !!error} onClick={() => setSelected(request)} className="px-4 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-50">Approve &amp; process</button> : <p className="text-amber-300 text-sm">Finance review required for this resolution.</p>}
        </article>;
      })}</div>
    </>}
    {selected && <div role="dialog" aria-modal="true" aria-label="Confirm refund" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="max-w-md w-full rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-6 space-y-4">
      <h3 className="font-bold text-white">Approve and process {currency(selected.requested_amount)}?</h3>
      <p className="text-slate-300">Refund the payment for {selected.jobs?.job_title || selected.job_id} through Stripe. This sends the refund; it does not just change a status.</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <div className="flex gap-3"><button disabled={busy || blockedJobs.has(selected.job_id)} onClick={() => void process()} className="rounded-lg px-4 py-2 bg-teal-600 text-white disabled:opacity-50">{busy ? 'Processing…' : 'Confirm refund'}</button><button disabled={busy} onClick={() => setSelected(null)} className="text-slate-300">Close</button></div>
    </div></div>}
  </section>;
}
