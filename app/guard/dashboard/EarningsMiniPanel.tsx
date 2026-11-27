'use client';

import Link from 'next/link';
import { JobAssignment } from './types';
import type { GuardDashboardSummary } from '@/lib/guard-dashboard-summary';

interface Props {
  summary: GuardDashboardSummary | null;
  assignments: JobAssignment[];
}

export default function EarningsMiniPanel({ summary, assignments }: Props) {
  const inProgress = assignments.filter(a => a.status === 'in_progress');
  const money = (amount: number | undefined) => amount === undefined ? '—' : `£${amount.toFixed(2)}`;
  const chart = summary?.recentPayouts || [];
  const maxAmount = Math.max(...chart.map(row => row.amount), 1);
  const chartBars = chart.map(row => ({ height: row.amount / maxAmount * 100, amount: row.amount }));
  const hasEarnings = (summary?.earned || 0) > 0;

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-money-pound-circle-line text-emerald-400"></i>
          </div>
          Earnings
        </h3>
        <Link href="/guard/earnings" className="text-xs text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap transition-colors">
          View All
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold text-white">{money(summary?.earned)}</p>
        <p className="text-xs text-slate-500 mt-1">Lifetime earnings</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span className="text-[10px] text-slate-500">Paid Out</span>
          </div>
          <p className="text-lg font-bold text-white">{money(summary?.earned)}</p>
        </div>
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span className="text-[10px] text-slate-500">Pending payouts</span>
          </div>
          <p className="text-lg font-bold text-white">{money(summary?.pending)}</p>
        </div>
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span className="text-[10px] text-slate-500">Active Jobs</span>
          </div>
          <p className="text-lg font-bold text-white">{inProgress.length}</p>
        </div>
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal-400"></div>
            <span className="text-[10px] text-slate-500">Completed</span>
          </div>
          <p className="text-lg font-bold text-white">{summary?.completed ?? '—'}</p>
        </div>
      </div>

      {chartBars.length > 0 ? (
        <div className="h-16 bg-[#0B1933] rounded-xl border border-[#1a2b4a] flex items-center justify-center">
          <div className="flex items-end gap-1 px-4">
            {chartBars.map((bar, i) => (
              <div
                key={i}
                className="w-4 bg-teal-500/40 rounded-t-sm transition-all hover:bg-teal-400"
                style={{ height: `${Math.max(bar.height * 0.6, 4)}px` }}
                title={`£${bar.amount.toFixed(2)}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-16 bg-[#0B1933] rounded-xl border border-[#1a2b4a] flex flex-col items-center justify-center gap-1">
          <i className="ri-bar-chart-line text-slate-600 text-lg"></i>
          <p className="text-[10px] text-slate-500">{!summary ? 'Earnings totals unavailable — retry dashboard data' : hasEarnings ? 'Payout history is available in Payment Centre' : 'No earnings data yet'}</p>
        </div>
      )}
      <p className="text-[10px] text-slate-600 text-center mt-2">
        {chartBars.length > 0 ? 'Recent released payouts' : hasEarnings ? 'Verified paid-out total' : summary ? 'Complete shifts to start earning' : 'Totals unavailable'}
      </p>
    </div>
  );
}
