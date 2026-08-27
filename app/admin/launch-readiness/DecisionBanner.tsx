'use client';

import type { Decision } from './types';

interface Props {
  decision: Decision;
  approved: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  passCount: number;
  failCount: number;
  warningCount: number;
  notVerifiedCount: number;
  loading: boolean;
}

export default function DecisionBanner({
  decision,
  approved,
  approvedBy,
  approvedAt,
  passCount,
  failCount,
  warningCount,
  notVerifiedCount,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl p-6 border border-[#1a2b4a] animate-pulse">
        <div className="w-40 h-8 bg-[#1a2b4a] rounded mb-4"></div>
        <div className="w-72 h-4 bg-[#1a2b4a] rounded"></div>
      </div>
    );
  }

  const config = {
    'GO': { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'ri-checkbox-circle-line', label: 'GO' },
    'CONDITIONAL GO': { ring: 'ring-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'ri-alert-line', label: 'CONDITIONAL GO' },
    'NO-GO': { ring: 'ring-red-500/40', bg: 'bg-red-500/10', text: 'text-red-400', icon: 'ri-close-circle-line', label: 'NO-GO' },
  }[decision];

  return (
    <div className={`bg-[#111d35] rounded-2xl border ${config.ring} ring-1 p-6 shadow-sm`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
          <div className="w-8 h-8 flex items-center justify-center">
            <i className={`${config.icon} ${config.text} text-4xl`}></i>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={`text-2xl font-extrabold tracking-tight ${config.text}`}>{config.label}</h2>
            {!approved && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#1a2b4a] text-slate-400 ring-1 ring-[#243a5e] whitespace-nowrap">
                Awaiting administrator approval
              </span>
            )}
            {approved && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 whitespace-nowrap">
                Approved
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {approved && approvedBy
              ? `Approved by ${approvedBy}${approvedAt ? ` on ${new Date(approvedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`
              : 'The overall decision is computed from the checks below and requires explicit approval before launch.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <CountBadge label="Pass" value={passCount} cls="bg-emerald-500/10 text-emerald-400" />
          <CountBadge label="Fail" value={failCount} cls="bg-red-500/10 text-red-400" />
          <CountBadge label="Warning" value={warningCount} cls="bg-amber-500/10 text-amber-400" />
          <CountBadge label="Not verified" value={notVerifiedCount} cls="bg-[#1a2b4a] text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function CountBadge({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${cls}`}>
      <span className="text-base leading-none">{value}</span>
      {label}
    </span>
  );
}