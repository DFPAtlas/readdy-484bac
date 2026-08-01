'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
// Shows last N activity log entries for the client dashboard widget
// Reads from app.client_activity_log via the public view

interface ActivityEntry {
  id: string;
  action_type: string;
  action_description: string;
  category: string;
  related_job_id: string | null;
  created_at: string;
  job_title?: string | null;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  account: { icon: 'ri-user-settings-line', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  job: { icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15' },
  applicant: { icon: 'ri-user-search-line', color: 'text-violet-400', bg: 'bg-violet-500/15' },
  guard: { icon: 'ri-shield-user-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  payment: { icon: 'ri-money-pound-circle-line', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  message: { icon: 'ri-message-3-line', color: 'text-sky-400', bg: 'bg-sky-500/15' },
  support: { icon: 'ri-customer-service-2-line', color: 'text-orange-400', bg: 'bg-orange-500/15' },
  cancellation: { icon: 'ri-close-circle-line', color: 'text-red-400', bg: 'bg-red-500/15' },
  refund: { icon: 'ri-refund-line', color: 'text-rose-400', bg: 'bg-rose-500/15' },
  document: { icon: 'ri-file-list-line', color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
  site: { icon: 'ri-building-line', color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  review: { icon: 'ri-star-line', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface RecentActivityProps {
  clientId: string;
  limit?: number;
}

export default function RecentActivity({ clientId, limit = 5 }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    const fetchActivities = async () => {
      const { data } = await supabase
        .from('client_activity_log')
        .select('id, action_type, action_description, category, related_job_id, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<ActivityEntry[]>();

      let entries = (data || []) as ActivityEntry[];

      const jobIds = entries.filter(e => e.related_job_id).map(e => e.related_job_id);
      if (jobIds.length > 0) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('id, job_title')
          .in('id', jobIds);
        const jobMap: Record<string, string> = {};
        (jobData || []).forEach((j: any) => { jobMap[j.id] = j.job_title; });
        entries = entries.map(e => ({ ...e, job_title: e.related_job_id ? jobMap[e.related_job_id] || null : null }));
      }

      setActivities(entries);
      setLoading(false);
    };

    fetchActivities();
  }, [clientId, limit]);

  const getConfig = (category: string) => CATEGORY_CONFIG[category] || CATEGORY_CONFIG.account;

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-32 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#162036] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-teal-500/15 rounded-lg">
            <i className="ri-history-line text-teal-400 text-sm"></i>
          </div>
          Recent Activity
        </h2>
        <Link
          href="/client/activity-log"
          className="text-sm text-teal-400 font-semibold hover:text-teal-300 cursor-pointer whitespace-nowrap"
        >
          View All
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-history-line text-xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-500">No recent activity</p>
          <p className="text-xs text-slate-600 mt-1">Actions will appear here as you use QuickGuard</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const config = getConfig(activity.category);
            return (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#162036] border border-[#1e2d4d] hover:border-slate-600 transition-colors">
                <div className={`w-9 h-9 flex items-center justify-center ${config.bg} rounded-lg flex-shrink-0`}>
                  <i className={`${config.icon} text-sm ${config.color}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{activity.action_description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                      {activity.category}
                    </span>
                    {activity.job_title && activity.related_job_id && (
                      <Link href={`/client/jobs/${activity.related_job_id}`}
                        className="text-xs text-teal-400 hover:text-teal-300 truncate cursor-pointer">
                        {activity.job_title}
                      </Link>
                    )}
                    <span className="text-xs text-slate-500 ml-auto" suppressHydrationWarning>
                      {formatTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}