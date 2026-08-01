'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ReplacementRequest {
  id: string;
  job_id: string;
  reason: string;
  urgency: string;
  required_arrival_time?: string;
  status: string;
  support_ticket_id?: string;
  created_at: string;
  updated_at: string;
  jobs?: { title: string; location?: string } | null;
}

interface ReplacementNotificationsSectionProps {
  clientId: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string; ring: string }> = {
  requested: {
    label: 'Requested',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: 'ri-time-line',
    ring: 'ring-amber-500/20',
  },
  searching: {
    label: 'Searching',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    icon: 'ri-search-line',
    ring: 'ring-blue-500/20',
  },
  replacement_offered: {
    label: 'Match Found',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    icon: 'ri-user-received-line',
    ring: 'ring-violet-500/20',
  },
  awaiting_client_approval: {
    label: 'Awaiting Approval',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    icon: 'ri-hourglass-line',
    ring: 'ring-orange-500/20',
  },
  replacement_confirmed: {
    label: 'Confirmed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: 'ri-checkbox-circle-line',
    ring: 'ring-emerald-500/20',
  },
  unable_to_fill: {
    label: 'Unable to Fill',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    icon: 'ri-close-circle-line',
    ring: 'ring-red-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    icon: 'ri-close-line',
    ring: 'ring-slate-500/20',
  },
};

export default function ReplacementNotificationsSection({ clientId }: ReplacementNotificationsSectionProps) {
  const [requests, setRequests] = useState<ReplacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const { data } = await supabase
        .from('replacement_requests')
        .select('*, jobs:job_id(title, location)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      setRequests((data || []) as ReplacementRequest[]);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    const channel = supabase
      .channel('replacement-notifications-section')
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'replacement_requests', filter: `client_id=eq.${clientId}` },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6 mb-6">
        <div className="h-5 bg-slate-100 dark:bg-[#162036] rounded w-48 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-28 bg-slate-100 dark:bg-[#162036] rounded-xl animate-pulse" />
          <div className="h-28 bg-slate-100 dark:bg-[#162036] rounded-xl animate-pulse" />
          <div className="h-28 bg-slate-100 dark:bg-[#162036] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-refresh-line text-violet-400 text-lg"></i>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Replacement Requests</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">No active replacement requests. When you request a replacement guard, updates will appear here.</p>
      </div>
    );
  }

  const active = requests.filter((r) => !['replacement_confirmed', 'cancelled'].includes(r.status));
  const confirmed = requests.filter((r) => r.status === 'replacement_confirmed').length;
  const unable = requests.filter((r) => r.status === 'unable_to_fill').length;
  const searching = requests.filter((r) => r.status === 'searching').length;
  const offered = requests.filter((r) => r.status === 'replacement_offered' || r.status === 'awaiting_client_approval').length;

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-refresh-line text-violet-400 text-lg"></i>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Replacement Requests</h2>
          <span className="bg-violet-500/15 text-violet-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {requests.length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {searching > 0 && (
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
              {searching} searching
            </span>
          )}
          {offered > 0 && (
            <span className="text-xs font-semibold text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full border border-violet-500/20">
              {offered} awaiting approval
            </span>
          )}
          {confirmed > 0 && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              {confirmed} confirmed
            </span>
          )}
          {unable > 0 && (
            <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20">
              {unable} unable to fill
            </span>
          )}
        </div>
      </div>

      {/* Quick summary cards for key statuses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {/* Match found */}
        <div className={`rounded-xl border p-4 ${
          offered > 0
            ? 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20'
            : 'bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d]'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              offered > 0 ? 'bg-violet-500/15' : 'bg-slate-200 dark:bg-[#1e2d4d]'
            }`}>
              <i className={`ri-user-received-line text-lg ${offered > 0 ? 'text-violet-400' : 'text-slate-400 dark:text-slate-600'}`}></i>
            </div>
            <span className={`text-sm font-semibold ${offered > 0 ? 'text-violet-500 dark:text-violet-400' : 'text-slate-500 dark:text-slate-500'}`}>
              Match Found
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {offered > 0
              ? `${offered} replacement guard${offered > 1 ? 's are' : ' is'} ready for your approval`
              : 'No replacement matches ready yet'}
          </p>
        </div>

        {/* Confirmed */}
        <div className={`rounded-xl border p-4 ${
          confirmed > 0
            ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
            : 'bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d]'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              confirmed > 0 ? 'bg-emerald-500/15' : 'bg-slate-200 dark:bg-[#1e2d4d]'
            }`}>
              <i className={`ri-checkbox-circle-line text-lg ${confirmed > 0 ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}></i>
            </div>
            <span className={`text-sm font-semibold ${confirmed > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-500'}`}>
              Confirmed
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {confirmed > 0
              ? `${confirmed} replacement${confirmed > 1 ? 's have' : ' has'} been confirmed`
              : 'No replacements confirmed yet'}
          </p>
        </div>

        {/* Unable to fill */}
        <div className={`rounded-xl border p-4 ${
          unable > 0
            ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
            : 'bg-slate-50 dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d]'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              unable > 0 ? 'bg-red-500/15' : 'bg-slate-200 dark:bg-[#1e2d4d]'
            }`}>
              <i className={`ri-close-circle-line text-lg ${unable > 0 ? 'text-red-400' : 'text-slate-400 dark:text-slate-600'}`}></i>
            </div>
            <span className={`text-sm font-semibold ${unable > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-500'}`}>
              Unable to Fill
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {unable > 0
              ? `${unable} request${unable > 1 ? 's' : ''} could not be filled — support will reach out`
              : 'No requests unable to fill'}
          </p>
        </div>
      </div>

      {/* Active request cards */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active Requests</p>
          {active.map((req) => {
            const cfg = statusConfig[req.status] || statusConfig.requested;
            const isExpanded = expandedId === req.id;
            const jobTitle = req.jobs?.title || 'Unknown Job';

            return (
              <div
                key={req.id}
                className={`rounded-xl border p-4 transition-all ${cfg.bg} ${cfg.ring} ring-1`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`${cfg.bg} ${cfg.color} border border-current/25 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1`}>
                        <i className={cfg.icon}></i>
                        {cfg.label}
                      </span>
                      {req.urgency === 'emergency' && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold px-2 py-1 rounded-full">
                          Emergency
                        </span>
                      )}
                      {req.urgency === 'urgent' && (
                        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold px-2 py-1 rounded-full">
                          Urgent
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {jobTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Requested {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/client/jobs/${req.job_id}`}
                      className="text-xs font-semibold text-teal-500 dark:text-teal-400 hover:text-teal-600 transition-colors whitespace-nowrap"
                    >
                      View Job
                    </Link>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#162036] transition-colors cursor-pointer"
                    >
                      <i className={isExpanded ? 'ri-arrow-up-s-line text-lg' : 'ri-arrow-down-s-line text-lg'}></i>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#1e2d4d] space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Reason</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium capitalize">{req.reason.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Urgency</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium capitalize">{req.urgency}</span>
                    </div>
                    {req.required_arrival_time && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Required Arrival</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {new Date(req.required_arrival_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {req.support_ticket_id && (
                      <div className="pt-1">
                        <Link
                          href={`/client/support?ticket=${req.support_ticket_id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <i className="ri-customer-service-2-line"></i>
                          View Linked Support Ticket
                          <i className="ri-arrow-right-line"></i>
                        </Link>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Link
                        href={`/client/jobs/${req.job_id}`}
                        className="inline-flex items-center gap-1.5 bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-teal-600 transition-colors"
                      >
                        <i className="ri-arrow-right-line"></i>
                        Go to Job
                      </Link>
                      {req.status === 'replacement_offered' || req.status === 'awaiting_client_approval' ? (
                        <Link
                          href={`/client/jobs/${req.job_id}`}
                          className="inline-flex items-center gap-1.5 bg-violet-500 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-violet-600 transition-colors"
                        >
                          <i className="ri-user-follow-line"></i>
                          Approve Replacement
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}