'use client';

import { useState } from 'react';

import { buildSafetyWarnings, type JobWithSafety, type GuardAssignment, type Warning } from '@/lib/client-safety';

interface ComplianceWarningsProps { jobs: JobWithSafety[]; assignments: Record<string, GuardAssignment[]>; warnings?: Warning[]; }

export default function ComplianceWarnings({ jobs, assignments, warnings: providedWarnings }: ComplianceWarningsProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const warnings = providedWarnings || buildSafetyWarnings(jobs, assignments);

  const filtered = filter === 'all' ? warnings : warnings.filter((w) => w.type === filter);

  if (warnings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i className="ri-check-double-line text-2xl text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No current warnings</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No actionable warnings for posted or booked jobs. Historical records remain available in the other tabs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border uppercase tracking-wide cursor-pointer transition-all ${
                filter === f
                  ? f === 'critical'
                    ? 'bg-red-500 text-white border-red-500'
                    : f === 'warning'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : f === 'info'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-teal-500 text-white border-teal-500'
                  : 'bg-white dark:bg-[#111d35] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e2d4d]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.map((w) => {
        const color = w.type === 'critical'
          ? 'bg-red-500/5 border-red-500/20 text-red-500'
          : w.type === 'warning'
          ? 'bg-amber-500/5 border-amber-500/20 text-amber-500'
          : 'bg-blue-500/5 border-blue-500/20 text-blue-500';
        const iconColor = w.type === 'critical'
          ? 'text-red-400'
          : w.type === 'warning'
          ? 'text-amber-400'
          : 'text-blue-400';

        return (
          <div
            key={w.id}
            className={`rounded-xl border p-4 ${color}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <i className={`${w.icon} ${iconColor} text-lg`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold">{w.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${
                    w.type === 'critical'
                      ? 'bg-red-500 text-white border-red-500'
                      : w.type === 'warning'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-500 text-white border-blue-500'
                  }`}>
                    {w.type}
                  </span>
                </div>
                <p className="text-xs opacity-80 mb-1">{w.message}</p>
                <p className="text-[10px] opacity-60 font-medium">{w.jobTitle}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
