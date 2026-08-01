'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('job_completion_requests')
        .select(`
          id, job_id, guard_id, status, requested_at, dispute_reason, notes,
          jobs:job_id(job_title, venue_city, agreed_amount),
          guards:guard_id(full_name)
        `)
        .order('requested_at', { ascending: false })
        .limit(100);
      setRequests((data || []) as CompletionRequest[]);
    } catch {}
    setLoading(false);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approve-job-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ requestId, action: 'admin_approve' }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setToast('Payment released');
      loadRequests();
    } catch (err: any) {
      setToast(err.message || 'Failed to process');
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
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white">Job Completion Requests</h2>
          <p className="text-sm text-slate-400 mt-1">Guards requesting completion approval and payment release</p>
        </div>
        <button onClick={loadRequests} className="px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/20 flex items-center gap-2 whitespace-nowrap cursor-pointer">
          <i className="ri-refresh-line"></i>Refresh
        </button>
      </div>

      <CompletionStatsCards counts={counts} filter={filter} onFilterChange={setFilter} />

      <CompletionRequestsTable
        requests={filtered}
        loading={loading}
        filter={filter}
        processing={processing}
        onApprove={handleAdminApprove}
      />

      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] border border-[#1e2d4d] shadow-lg px-5 py-3 rounded-xl flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-emerald-400"></i>
          <span className="text-sm font-medium text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}