'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RecentJob {
  id: string;
  job_title: string;
  venue_city: string;
  postcode: string;
  start_date: string;
  status: string;
  applications_count: number;
  assigned_count: number;
  needs_payment: boolean;
  needs_review?: boolean;
  reviewed_count?: number;
}

interface RecentJobsProps {
  jobs: RecentJob[];
  loading?: boolean;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    draft: { label: 'Draft', bg: 'bg-slate-500/15', color: 'text-slate-500', border: 'border-slate-500/25' },
    open: { label: 'Posted', bg: 'bg-blue-500/15', color: 'text-blue-500', border: 'border-blue-500/25' },
    active: { label: 'Active', bg: 'bg-emerald-500/15', color: 'text-emerald-500', border: 'border-emerald-500/25' },
    completed: { label: 'Completed', bg: 'bg-slate-500/15', color: 'text-slate-500', border: 'border-slate-500/25' },
    payment_pending: { label: 'Payment Due', bg: 'bg-amber-500/15', color: 'text-amber-500', border: 'border-amber-500/25' },
    cancelled: { label: 'Cancelled', bg: 'bg-red-500/15', color: 'text-red-500', border: 'border-red-500/25' },
  };
  return map[status] || map.open;
}

export default function RecentJobs({ jobs, loading = false }: RecentJobsProps) {
  const router = useRouter();
  const [toast, setToast] = useState('');

  const handleDuplicate = (job: RecentJob) => {
    router.push(`/client/post-job?site=${job.id}`);
  };

  const handleSaveTemplate = async (job: RecentJob) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userData.user?.id)
        .maybeSingle();
      if (!client) return;
      await supabase.schema('app').from('job_templates').insert({
        client_id: client.id,
        template_name: job.job_title || 'Job Template',
        job_title: job.job_title,
        venue: job.venue_city || '',
        hourly_rate: '15',
      });
      setToast('Saved as template');
    } catch {
      setToast('Failed to save template');
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6">
        <div className="h-5 bg-slate-200 dark:bg-[#1e2d4d] rounded w-32 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-[#1e2d4d] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6">
      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d]">
          <i className="ri-checkbox-circle-fill text-teal-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Jobs</h2>
        <Link
          href="/client/jobs"
          className="text-sm text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
        >
          View All
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-briefcase-4-line text-2xl text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No jobs yet</p>
          <p className="text-xs text-slate-500 mt-1">Post your first job to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const badge = statusBadge(job.status);
            return (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-[#1e2d4d] bg-slate-50 dark:bg-[#162036] hover:bg-slate-100 dark:hover:bg-[#1a2642] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {job.job_title}
                    </h3>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.color} ${badge.border}`}>
                      {badge.label}
                    </span>
                    {job.needs_review && (
                      <span className="shrink-0 text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded-full">
                        <i className="ri-star-line mr-0.5" />
                        Review Needed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-line" />
                      {job.venue_city || job.postcode || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line" />
                      {job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-user-line" />
                      {job.applications_count} applicants
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-shield-user-line" />
                      {job.assigned_count} assigned
                    </span>
                    {job.needs_review && job.reviewed_count !== undefined && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <i className="ri-star-line" />
                        {job.reviewed_count}/{job.assigned_count} reviewed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-1 sm:mt-0">
                  <button
                    onClick={() => router.push(`/client/jobs/${job.id}`)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    View Job
                  </button>
                  <button
                    onClick={() => handleDuplicate(job)}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#162036] border border-[#1e2d4d] rounded-lg text-slate-300 hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-file-copy-line mr-1"></i>Duplicate
                  </button>
                  <button
                    onClick={() => handleSaveTemplate(job)}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#162036] border border-[#1e2d4d] rounded-lg text-slate-300 hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-save-line mr-1"></i>Save Template
                  </button>
                  {job.applications_count > 0 && job.status !== 'completed' && job.status !== 'cancelled' && (
                    <button
                      onClick={() => router.push(`/client/jobs/${job.id}`)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Review Applicants
                    </button>
                  )}
                  {job.assigned_count > 0 && job.status !== 'completed' && job.status !== 'cancelled' && (
                    <button
                      onClick={() => router.push(`/client/jobs/${job.id}/select-guards`)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Manage Guards
                    </button>
                  )}
                  {job.needs_payment && (
                    <button
                      onClick={() => router.push(`/client/jobs/${job.id}/payment`)}
                      className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Pay Now
                    </button>
                  )}
                  {job.needs_review && (
                    <button
                      onClick={() => router.push(`/client/jobs/${job.id}`)}
                      className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-star-line mr-1" />
                      Leave Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}