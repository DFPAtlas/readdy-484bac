'use client';

import Link from 'next/link';
import { JobAssignment } from './types';

interface Props {
  guard: any;
  assignments: JobAssignment[];
}

export default function EarningsMiniPanel({ guard, assignments }: Props) {
  const completed = assignments.filter(a => a.status === 'completed');
  const inProgress = assignments.filter(a => a.status === 'in_progress');
  const pendingPayout = assignments.filter(a => a.payment_status === 'pending');
  const paid = assignments.filter(a => a.payment_status === 'paid');

  const completedEarnings = completed.reduce((sum, a) => sum + (a.payment_amount || 0), 0);
  const pendingEarnings = pendingPayout.reduce((sum, a) => sum + (a.payment_amount || 0), 0);
  const paidEarnings = paid.reduce((sum, a) => sum + (a.payment_amount || 0), 0);
  const totalEarnings = Number(guard?.total_earnings || 0);

  // Build real chart data from completed assignments sorted by job date
  const recentCompleted = [...completed]
    .sort((a, b) => {
      const da = (a.jobs as any)?.start_date || a.assigned_at || '';
      const db = (b.jobs as any)?.start_date || b.assigned_at || '';
      return da.localeCompare(db);
    })
    .slice(-7);

  const maxAmount = Math.max(...recentCompleted.map(a => a.payment_amount || 0), 1);
  const chartBars = recentCompleted.map(a => ({
    height: ((a.payment_amount || 0) / maxAmount) * 100,
    amount: a.payment_amount || 0,
  }));

  const hasEarnings = totalEarnings > 0 || chartBars.length > 0;

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
        <p className="text-3xl font-bold text-white">£{totalEarnings.toFixed(2)}</p>
        <p className="text-xs text-slate-500 mt-1">Lifetime earnings</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span className="text-[10px] text-slate-500">Paid Out</span>
          </div>
          <p className="text-lg font-bold text-white">£{paidEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span className="text-[10px] text-slate-500">Pending</span>
          </div>
          <p className="text-lg font-bold text-white">£{pendingEarnings.toFixed(2)}</p>
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
          <p className="text-lg font-bold text-white">{completed.length}</p>
        </div>
      </div>

      {hasEarnings ? (
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
          <p className="text-[10px] text-slate-500">No earnings data yet</p>
        </div>
      )}
      <p className="text-[10px] text-slate-600 text-center mt-2">
        {hasEarnings ? 'Recent job earnings' : 'Complete shifts to start earning'}
      </p>
    </div>
  );
}