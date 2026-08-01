'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import CompletionReviewModal from './CompletionReviewModal';

interface CompletionRequest {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  requested_at: string;
  notes: string | null;
  jobs: { job_title: string; venue_city: string; start_date: string; hourly_rate: number; agreed_amount: number | null } | null;
  guards: { full_name: string; profile_image_url: string | null; rating: number | null } | null;
}

interface Props {
  clientId: string;
}

export default function CompletionApprovalPanel({ clientId }: Props) {
  const [requests, setRequests] = useState<CompletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CompletionRequest | null>(null);
  const [toast, setToast] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-completion-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();
      if (data.requests) {
        const pending = data.requests.filter((r: CompletionRequest) => r.status === 'pending');
        setRequests(pending);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [clientId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading completion requests...</p>
        </div>
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#1e2d4d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-amber-400 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Jobs Awaiting Approval</h2>
              <p className="text-sm text-slate-400">{requests.length} job{requests.length !== 1 ? 's' : ''} completed by guards — review and release payment</p>
            </div>
          </div>
          <button
            onClick={loadRequests}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <i className="ri-refresh-line"></i>
          </button>
        </div>

        <div className="divide-y divide-[#1e2d4d]">
          {requests.map((req) => (
            <div key={req.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center flex-shrink-0">
                {req.guards?.profile_image_url ? (
                  <img src={req.guards.profile_image_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <i className="ri-user-line text-xl text-slate-500"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{req.jobs?.job_title || 'Job'}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Completed by <span className="text-teal-400">{req.guards?.full_name || 'Guard'}</span>
                      {req.guards?.rating && <span className="text-amber-400 ml-1">★ {req.guards.rating}</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {req.jobs?.venue_city} • {req.jobs?.start_date ? new Date(req.jobs.start_date).toLocaleDateString('en-GB') : ''}
                    </p>
                    {req.notes && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{req.notes}"</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-teal-400">
                      {req.jobs?.agreed_amount ? `£${Number(req.jobs.agreed_amount).toFixed(2)}` : `£${req.jobs?.hourly_rate || 0}/hr`}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(req.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => setSelectedRequest(req)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-check-double-line"></i>
                    Approve & Release
                  </button>
                  <button
                    onClick={() => setSelectedRequest(req)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-orange-500/30 text-orange-400 rounded-xl text-sm font-semibold hover:bg-orange-500/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-alert-line"></i>
                    Dispute
                  </button>
                  <Link
                    href={`/client/jobs/${req.job_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-[#1e2d4d] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-eye-line"></i>
                    View Job
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRequest && (
        <CompletionReviewModal
          requestId={selectedRequest.id}
          guardName={selectedRequest.guards?.full_name || 'Guard'}
          jobTitle={selectedRequest.jobs?.job_title || 'Job'}
          onSuccess={() => {
            setToast('Completion processed successfully');
            loadRequests();
          }}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d]">
          <i className="ri-checkbox-circle-fill text-emerald-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}