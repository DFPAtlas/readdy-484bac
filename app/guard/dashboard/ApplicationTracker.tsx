'use client';

import { guardApplicationGroup } from '@/lib/guard-application-status';
import { JobApplication } from './types';

interface Props {
  applications: JobApplication[];
  applicationsUsed?: number;
}

export default function ApplicationTracker({ applications, applicationsUsed }: Props) {
  const active = applications.filter(a => a.status !== 'withdrawn');
  const pending = active.filter(a => guardApplicationGroup(a.status) === 'pending').length;
  const reviewed = active.filter(a => guardApplicationGroup(a.status) === 'reviewed').length;
  const selected = active.filter(a => guardApplicationGroup(a.status) === 'selected').length;
  const accepted = active.filter(a => guardApplicationGroup(a.status) === 'accepted').length;
  const declined = active.filter(a => guardApplicationGroup(a.status) === 'declined').length;

  const used = applicationsUsed ?? applications.length;

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-send-plane-line text-teal-400"></i>
        </div>
        Applications
      </h3>

      <div className="mb-4">
        <p className="text-3xl font-bold text-white">{used}</p>
        <p className="text-xs text-slate-500">{applicationsUsed === undefined ? 'applications tracked' : 'submitted this month'}</p>
        <p className="mt-2 text-xs text-teal-400">Free applications. No monthly cap.</p>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <div className="text-center p-2 rounded-xl bg-[#0B1933] border border-[#1a2b4a]"><p className="text-lg font-bold text-violet-400">{selected}</p><p className="text-[10px] text-slate-500">Selected</p></div>
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