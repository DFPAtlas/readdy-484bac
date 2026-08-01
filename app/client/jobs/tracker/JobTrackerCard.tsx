'use client';

import Link from 'next/link';

interface JobTrackerCardProps {
  job: any;
  onRefresh: () => void;
}

const STEPS = [
  { key: 'posted', label: 'Job Posted', icon: 'ri-file-add-line', activeStatuses: ['pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress', 'completed'] },
  { key: 'applications', label: 'Applications', icon: 'ri-user-received-line', activeStatuses: ['awaiting_guard_selection', 'awaiting_payment', 'in_progress', 'completed'] },
  { key: 'guards_selected', label: 'Guards Selected', icon: 'ri-user-follow-line', activeStatuses: ['awaiting_payment', 'in_progress', 'completed'] },
  { key: 'payment', label: 'Payment', icon: 'ri-secure-payment-line', activeStatuses: ['in_progress', 'completed'] },
  { key: 'complete', label: 'Complete', icon: 'ri-trophy-line', activeStatuses: ['completed'] },
];

function getStepState(step: typeof STEPS[0], jobStatus: string): 'done' | 'active' | 'pending' {
  if (jobStatus === 'cancelled') return 'pending';
  const order = ['pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress', 'completed'];
  const currentIdx = order.indexOf(jobStatus);
  const stepActiveIdx = order.indexOf(step.activeStatuses[0]);
  if (currentIdx > stepActiveIdx) return 'done';
  if (step.activeStatuses.includes(jobStatus)) return 'active';
  return 'pending';
}

function getStatusConfig(status: string) {
  const map: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
    pending: { bg: 'bg-[#162036]', text: 'text-slate-400', border: 'border-[#1e2d4d]', label: 'Pending Review', dot: 'bg-slate-500' },
    awaiting_guard_selection: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', label: 'Awaiting Guard Selection', dot: 'bg-amber-400' },
    awaiting_payment: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', label: 'Awaiting Payment', dot: 'bg-orange-400' },
    in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', label: 'In Progress', dot: 'bg-blue-500' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', label: 'Completed', dot: 'bg-emerald-500' },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', label: 'Cancelled', dot: 'bg-red-500' },
  };
  return map[status] || map.pending;
}

function getActionBanner(job: any) {
  if (job.status === 'awaiting_guard_selection' && job.applications_count > 0) {
    return {
      bg: 'bg-amber-50 border-amber-200',
      icon: 'ri-user-search-line',
      iconColor: 'text-amber-600',
      text: `${job.applications_count} guard${job.applications_count !== 1 ? 's' : ''} applied — review and select now`,
      cta: { label: 'Select Guards', href: `/client/jobs/${job.id}/select-guards`, color: 'bg-amber-500 hover:bg-amber-600 text-white' },
    };
  }
  if (job.status === 'awaiting_payment') {
    return {
      bg: 'bg-orange-50 border-orange-200',
      icon: 'ri-secure-payment-line',
      iconColor: 'text-orange-600',
      text: 'Guards are ready — complete payment to confirm the booking',
      cta: { label: 'Pay Now', href: `/client/jobs/${job.id}/payment`, color: 'bg-orange-500 hover:bg-orange-600 text-white' },
    };
  }
  if (job.status === 'awaiting_guard_selection' && job.applications_count === 0) {
    return {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'ri-time-line',
      iconColor: 'text-blue-500',
      text: 'Your job is live — waiting for guards to apply',
      cta: null,
    };
  }
  return null;
}

export default function JobTrackerCard({ job, onRefresh }: JobTrackerCardProps) {
  const statusConfig = getStatusConfig(job.status);
  const actionBanner = getActionBanner(job);
  const isCancelled = job.status === 'cancelled';
  const hasReplacementIssue = job.no_show_count > 0 || job.late_count > 0 || job.issue_count > 0;

  return (
    <div className={`bg-[#111d35] rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isCancelled ? 'border-red-500/25 opacity-75' : hasReplacementIssue ? 'border-amber-500/25' : 'border-[#1e2d4d]'}`}>
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between mb-4 md:mb-5">
          <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-red-500/10' : hasReplacementIssue ? 'bg-amber-500/15' : 'bg-teal-500/15'}`}>
              <i className={`ri-briefcase-4-line text-lg md:text-xl ${isCancelled ? 'text-red-400' : hasReplacementIssue ? 'text-amber-400' : 'text-teal-400'}`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h3 className="text-sm md:text-base font-bold text-slate-200 truncate">{job.job_title}</h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${['in_progress', 'awaiting_guard_selection'].includes(job.status) ? 'animate-pulse' : ''}`}></span>
                  {statusConfig.label}
                </span>
                {hasReplacementIssue && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/25 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    Needs Replacement
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-slate-500">
                {(job.venue_name || job.venue_city) && (
                  <span className="flex items-center gap-1">
                    <i className="ri-map-pin-line text-slate-600 text-xs"></i>
                    {job.venue_name ? `${job.venue_name}, ${job.venue_city}` : job.venue_city}
                  </span>
                )}
                {job.start_date && (
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line text-slate-600 text-xs"></i>
                    {new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
                {job.start_time && job.end_time && (
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line text-slate-600 text-xs"></i>
                    {job.start_time} – {job.end_time}
                  </span>
                )}
                {job.status === 'in_progress' && (job.checked_in_count > 0 || job.late_count > 0 || job.no_show_count > 0) && (
                  <span className="flex items-center gap-1">
                    <i className="ri-pulse-line text-slate-600 text-xs"></i>
                    <span className="flex items-center gap-1.5">
                      {job.checked_in_count > 0 && (
                        <span className="text-xs font-semibold text-emerald-400">{job.checked_in_count} in</span>
                      )}
                      {job.late_count > 0 && (
                        <span className="text-xs font-semibold text-amber-400">{job.late_count} late</span>
                      )}
                      {job.no_show_count > 0 && (
                        <span className="text-xs font-semibold text-red-400">{job.no_show_count} no-show</span>
                      )}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <p className="text-base md:text-xl font-bold text-teal-400">£{job.hourly_rate}/hr</p>
            <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">{job.number_of_guards} guard{job.number_of_guards !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {!isCancelled && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</p>
              <p className="text-xs text-slate-500">
                Step {Math.min(STEPS.findIndex(s => s.activeStatuses.includes(job.status)) + 1 || 1, STEPS.length)} of {STEPS.length}
              </p>
            </div>
            <div className="flex items-center w-full">
              {STEPS.map((step, index) => {
                const state = getStepState(step, job.status);
                const isLast = index === STEPS.length - 1;
                return (
                  <div key={step.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                        ${state === 'done' ? 'bg-emerald-500 text-white shadow-sm' : ''}
                        ${state === 'active' ? 'bg-teal-500 text-white ring-4 ring-teal-500/20 shadow-sm' : ''}
                        ${state === 'pending' ? 'bg-[#162036] text-slate-600' : ''}
                      `}>
                        {state === 'done' ? (
                          <i className="ri-check-line text-sm font-bold"></i>
                        ) : (
                          <i className={`${step.icon} text-sm`}></i>
                        )}
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap
                        ${state === 'done' ? 'text-emerald-400' : ''}
                        ${state === 'active' ? 'text-teal-400' : ''}
                        ${state === 'pending' ? 'text-slate-600' : ''}
                      `}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all
                        ${state === 'done' ? 'bg-emerald-500/50' : 'bg-[#1e2d4d]'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {actionBanner && (
          <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border mb-4 ${actionBanner.bg}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className={`${actionBanner.icon} text-base ${actionBanner.iconColor}`}></i>
              </div>
              <p className="text-sm font-medium text-slate-200 truncate">{actionBanner.text}</p>
            </div>
            {actionBanner.cta && (
              <Link href={actionBanner.cta.href}>
                <button className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${actionBanner.cta.color}`}>
                  {actionBanner.cta.label}
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Replacement action banner */}
        {hasReplacementIssue && job.status === 'in_progress' && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border bg-red-500/5 border-red-500/15 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className="ri-refresh-line text-base text-red-400"></i>
              </div>
              <p className="text-sm font-medium text-red-400">Guard attendance issue — request a replacement</p>
            </div>
            <Link href={`/client/jobs/${job.id}`}>
              <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap">
                View Job
              </button>
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-[#1e2d4d]">
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-user-received-line text-slate-600 text-sm"></i>
              </div>
              <span className="font-semibold text-slate-300">{job.applications_count}</span>
              <span>applicant{job.applications_count !== 1 ? 's' : ''}</span>
            </span>
            {job.assigned_guards > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-user-follow-line text-sm"></i>
                </div>
                {job.assigned_guards} assigned
              </span>
            )}
            {job.status === 'in_progress' && (job.checked_in_count > 0 || job.late_count > 0 || job.no_show_count > 0) && (
              <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-pulse-line text-xs"></i>
                </div>
                <span className="flex items-center gap-1">
                  {job.checked_in_count > 0 && (
                    <span className="text-xs font-semibold text-emerald-400">{job.checked_in_count} in</span>
                  )}
                  {job.late_count > 0 && (
                    <span className="text-xs font-semibold text-amber-400">{job.late_count} late</span>
                  )}
                  {job.no_show_count > 0 && (
                    <span className="text-xs font-semibold text-red-400">{job.no_show_count} no-show</span>
                  )}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-500 text-xs">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-calendar-line text-xs"></i>
              </div>
              Posted {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <div className="flex gap-2">
            <Link href={`/client/jobs/${job.id}`}>
              <button className="flex items-center gap-1.5 bg-[#162036] text-slate-300 px-4 py-2 rounded-xl hover:bg-[#1a2642] transition-colors text-sm font-semibold whitespace-nowrap cursor-pointer border border-[#1e2d4d]">
                <i className="ri-eye-line text-sm"></i>
                View Details
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
