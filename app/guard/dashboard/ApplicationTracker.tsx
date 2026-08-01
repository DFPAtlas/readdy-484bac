'use client';

import Link from 'next/link';
import { JobApplication } from './types';

interface Props {
  applications: JobApplication[];
  planName?: string;
  periodEnd?: string;
  applicationLimit?: number;
  applicationsUsed?: number;
}

export default function ApplicationTracker({ applications, planName, periodEnd, applicationLimit, applicationsUsed }: Props) {
  const active = applications.filter(a => a.status !== 'withdrawn');
  const pending = active.filter(a => a.status === 'pending').length;
  const reviewed = active.filter(a => a.status === 'reviewed').length;
  const accepted = active.filter(a => a.status === 'accepted' || a.status === 'confirmed').length;
  const declined = active.filter(a => a.status === 'declined' || a.status === 'rejected').length;

  const used = applicationsUsed ?? active.length;
  const limit = applicationLimit ?? 10;
  const remaining = Math.max(0, limit - used);
  const progressPct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-send-plane-line text-teal-400"></i>
        </div>
        Applications
      </h3>

      <div className="mb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-3xl font-bold text-white">{remaining}</p>
            <p className="text-xs text-slate-500">remaining this month</p>
          </div>
          <p className="text-sm text-slate-400">{used} of {limit} used</p>
        </div>
        <div className="w-full h-2.5 bg-[#1a2b4a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressPct >= 90 ? 'bg-red-400' : progressPct >= 70 ? 'bg-amber-400' : 'bg-teal-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {planName && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a2b4a]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-lg text-xs font-semibold">{planName}</span>
              {periodEnd && (
                <span className="text-xs text-slate-500">Resets {new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              )}
            </div>
            <Link href="/upgrade" className="text-xs text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap transition-colors">
              Upgrade Plan
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div className="text-center p-2 rounded-xl bg-[#0B1933] border border-[#1a2b4a]">
          <p className="text-lg font-bold text-amber-400">{pending}</p>
          <p className="text-[10px] text-slate-500">Pending</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-[#0B1933] border border-[#1a2b4a]">
          <p className="text-lg font-bold text-blue-400">{reviewed}</p>
          <p className="text-[10px] text-slate-500">Reviewed</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-[#0B1933] border border-[#1a2b4a]">
          <p className="text-lg font-bold text-emerald-400">{accepted}</p>
          <p className="text-[10px] text-slate-500">Accepted</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-[#0B1933] border border-[#1a2b4a]">
          <p className="text-lg font-bold text-red-400">{declined}</p>
          <p className="text-[10px] text-slate-500">Declined</p>
        </div>
      </div>
    </div>
  );
}