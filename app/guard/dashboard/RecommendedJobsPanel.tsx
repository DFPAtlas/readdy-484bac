'use client';

import Link from 'next/link';
import { AvailableJobWithDistance, Guard } from './types';

interface Props {
  jobs: AvailableJobWithDistance[];
  guard: Guard | null;
  onApply: (jobId: string) => void;
  hasApplied: (jobId: string) => boolean;
}

export default function RecommendedJobsPanel({ jobs, guard, onApply, hasApplied }: Props) {
  const nearby = jobs.filter(job => job.distanceMiles !== null && job.distanceMiles <= 50);
  const displayed = nearby.length > 0 ? nearby.slice(0, 6) : jobs.slice(0, 6);

  if (displayed.length === 0) {
    return (
      <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-radar-line text-teal-400"></i>
          </div>
          Nearby Jobs
        </h2>
        <div className="text-center py-10 px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] flex items-center justify-center">
            <i className="ri-briefcase-line text-3xl text-slate-600"></i>
          </div>
          <p className="text-sm font-semibold text-white mb-1">No Jobs Available</p>
          <p className="text-xs text-slate-500">Check back soon — new jobs are posted daily</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-radar-line text-teal-400"></i>
          </div>
          Nearby Jobs
        </h2>
        <Link href="/guard/jobs" className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors whitespace-nowrap">
          Browse All
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayed.map((job) => (
          <div key={job.id} className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-4 hover:border-[#2a3e5f] hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{job.job_title}</h3>
                {job.distanceLabel && (
                  <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-[10px] font-semibold">
                    <i className="ri-map-pin-line text-[9px]"></i>
                    {job.distanceLabel}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-teal-400 shrink-0 ml-2">£{job.hourly_rate}/hr</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">{job.clients?.company_name || 'Company'}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
              <span className="flex items-center gap-1"><i className="ri-map-pin-line text-slate-600"></i>{job.venue_city}</span>
              <span className="flex items-center gap-1"><i className="ri-calendar-line text-slate-600"></i>{job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/guard/jobs/${job.id}`} className="flex-1 text-center px-3 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] hover:border-[#2a3e5f] transition-all whitespace-nowrap">Details</Link>
              {hasApplied(job.id) ? (
                <button disabled className="flex-1 text-center px-3 py-2.5 bg-[#162036] text-slate-500 border border-[#1a2b4a] rounded-xl text-xs font-semibold cursor-not-allowed whitespace-nowrap">Applied</button>
              ) : (
                <button onClick={() => onApply(job.id)} className="flex-1 text-center px-3 py-2.5 bg-teal-500 text-white rounded-xl text-xs font-semibold hover:bg-teal-400 shadow-lg shadow-teal-500/20 transition-all whitespace-nowrap">Apply Now</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}