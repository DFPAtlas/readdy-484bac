'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {adminFunction} from '@/lib/adminFunction';
import CompletionStatsCards from './CompletionStatsCards';
import CompletionRequestsTable from './CompletionRequestsTable';

interface CompletionRequest {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  requested_at: string;
  dispute_reason: string | null;
  notes: string | null;
  jobs: { job_title: string; venue_city: string; agreed_amount: number | null } | null;
  guards: { full_name: string } | null;
}

export default function CompletionRequestsPanel() {
  const [requests, setRequests] = useState<CompletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('job_completion_requests')
        .select('id, job_id, guard_id, status, requested_at, dispute_reason, notes')
        .order('requested_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) {
        setRequests([]);
        return;
      }
      // Completion requests have no foreign keys. Read their related records
      // separately, retaining the signed-in administrator's RLS permissions.
      const [jobsResult, guardsResult] = await Promise.all([
        supabase.from('jobs').select('id, job_title, venue_city, agreed_amount')
          .in('id', [...new Set(rows.map(row => row.job_id))]),
        supabase.from('guards').select('id, full_name')
          .in('id', [...new Set(rows.map(row => row.guard_id))]),
      ]);
      if (jobsResult.error) throw jobsResult.error;
      if (guardsResult.error) throw guardsResult.error;
      const jobs = new Map((jobsResult.data || []).map(job => [job.id, job]));
      const guards = new Map((guardsResult.data || []).map(guard => [guard.id, guard]));
      setRequests(rows.map(row => ({
        ...row, jobs: jobs.get(row.job_id) || null, guards: guards.get(row.guard_id) || null,
      })));
    } catch {
      setRequests([]);
      setLoadError('Unable to load completion requests. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleAdminApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const data = await adminFunction('approve-job-completion', {requestId,action:'admin_approve'});
      if (data.payoutInitiated) {
        setToast(data.message || 'Completion approved; payout processing started');
      } else {
        setToast(data.payoutWarning || 'Completion approved but payout requires attention');
      }
      loadRequests();
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    disputed: requests.filter(r => r.status === 'disputed').length,
  };

  return (
    <div id="completion-requests" className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white">Job Completion Requests</h2>
          <p className="text-sm text-slate-400 mt-1">Guards requesting completion approval and payment release</p>
        </div>
        <button onClick={loadRequests} disabled={loading} className="px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/20 flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50">
          <i className="ri-refresh-line"></i>Refresh
        </button>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <p>{loadError}</p>
          <button onClick={loadRequests} className="mt-2 underline">Retry completion requests</button>
        </div>
      ) : (
        <>
          {!loading && <CompletionStatsCards counts={counts} filter={filter} onFilterChange={setFilter} />}

          <CompletionRequestsTable
            requests={filtered}
            loading={loading}
            filter={filter}
            processing={processing}
            onApprove={handleAdminApprove}
          />
        </>
      )}

      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] border border-[#1e2d4d] shadow-lg px-5 py-3 rounded-xl flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-emerald-400"></i>
          <span className="text-sm font-medium text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
