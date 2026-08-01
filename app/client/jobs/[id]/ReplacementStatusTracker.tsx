'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ReplacementRequest {
  id: string;
  job_id: string;
  guard_id?: string;
  reason: string;
  urgency: string;
  required_arrival_time?: string;
  notes?: string;
  contact_phone?: string;
  status: string;
  support_ticket_id?: string;
  created_at: string;
  updated_at: string;
}

interface ReplacementStatusTrackerProps {
  jobId: string;
  clientId: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string; description: string }> = {
  requested: {
    label: 'Requested',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: 'ri-time-line',
    description: 'Your request has been received and is being reviewed',
  },
  searching: {
    label: 'Searching',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    icon: 'ri-search-line',
    description: 'QuickGuard is actively searching for available guards',
  },
  replacement_offered: {
    label: 'Replacement Offered',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    icon: 'ri-user-received-line',
    description: 'A replacement guard has been found — awaiting your approval',
  },
  awaiting_client_approval: {
    label: 'Awaiting Approval',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    icon: 'ri-hourglass-line',
    description: 'Please approve the replacement guard to confirm the booking',
  },
  replacement_confirmed: {
    label: 'Confirmed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: 'ri-checkbox-circle-line',
    description: 'Replacement guard has been confirmed and assigned',
  },
  unable_to_fill: {
    label: 'Unable to Fill',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    icon: 'ri-close-circle-line',
    description: 'We were unable to find a replacement — our support team will contact you',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    icon: 'ri-close-line',
    description: 'The replacement request has been cancelled',
  },
};

const statusOrder = ['requested', 'searching', 'replacement_offered', 'awaiting_client_approval', 'replacement_confirmed', 'unable_to_fill', 'cancelled'];

export default function ReplacementStatusTracker({ jobId, clientId }: ReplacementStatusTrackerProps) {
  const [requests, setRequests] = useState<ReplacementRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      const { data } = await supabase
        .from('replacement_requests')
        .select('*')
        .eq('job_id', jobId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      setRequests(data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    const channel = supabase
      .channel(`replacement-requests-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'replacement_requests', filter: `job_id=eq.${jobId}` }, () => {
        loadRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId, clientId]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-40 mb-4 animate-pulse"></div>
        <div className="h-24 bg-[#162036] rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-refresh-line text-violet-400 text-lg"></i>
          </div>
          Replacement Requests
          <span className="bg-violet-500/15 text-violet-400 text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
        </h2>
      </div>

      <div className="space-y-4">
        {requests.map((req) => {
          const cfg = statusConfig[req.status] || statusConfig.requested;
          const currentIdx = statusOrder.indexOf(req.status);

          return (
            <div key={req.id} className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              {/* Status badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`${cfg.bg} ${cfg.color} border border-current/25 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1`}>
                  <i className={cfg.icon}></i>
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center gap-1">
                  {statusOrder.slice(0, 5).map((s, i) => {
                    const isDone = i <= currentIdx && currentIdx < 5;
                    const isActive = i === currentIdx;
                    return (
                      <div key={s} className="flex-1 flex items-center">
                        <div className={`h-2 rounded-full transition-all flex-1 ${
                          isDone ? 'bg-teal-500' : isActive ? 'bg-teal-500/50' : 'bg-[#1e2d4d]'
                        }`} />
                        {i < 4 && (
                          <div className={`w-1 h-2 mx-0.5 rounded-full ${
                            isDone ? 'bg-teal-500' : 'bg-[#1e2d4d]'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {['Requested', 'Searching', 'Found', 'Approval', 'Confirmed'].map((label, i) => (
                    <span key={label} className={`text-[10px] font-medium ${
                      i <= currentIdx ? 'text-teal-400' : 'text-slate-600'
                    }`}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reason</span>
                  <span className="text-slate-200 font-medium">{req.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Urgency</span>
                  <span className={`font-semibold ${
                    req.urgency === 'emergency' ? 'text-red-400' : req.urgency === 'urgent' ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {req.urgency === 'emergency' ? 'Emergency Cover' : req.urgency === 'urgent' ? 'Urgent' : 'Normal'}
                  </span>
                </div>
                {req.required_arrival_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Required by</span>
                    <span className="text-slate-200 font-medium">
                      {new Date(req.required_arrival_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {req.notes && (
                  <div className="pt-1">
                    <span className="text-slate-500 text-xs">Notes</span>
                    <p className="text-xs text-slate-400 mt-0.5">{req.notes}</p>
                  </div>
                )}
              </div>

              {/* Support ticket link */}
              {req.support_ticket_id && (
                <div className="mt-3 pt-3 border-t border-[#1e2d4d]">
                  <Link
                    href={`/client/support?ticket=${req.support_ticket_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <i className="ri-customer-service-2-line"></i>
                    View Support Ticket
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-slate-500 mt-2">{cfg.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}