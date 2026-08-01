'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkGuardApplicationLimit, GuardApplicationLimit } from '@/lib/guard-application-limits';
import { getGuardAccessLevel } from '@/lib/job-access-levels';

interface Props {
  guardId: string;
  refreshTrigger?: number;
}

export default function GuardUsageWidget({ guardId, refreshTrigger }: Props) {
  const [limitData, setLimitData] = useState<GuardApplicationLimit | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsage = async () => {
    setLoading(true);
    const result = await checkGuardApplicationLimit(supabase, guardId);
    setLimitData(result);
    setLoading(false);
  };

  useEffect(() => {
    loadUsage();
  }, [guardId, refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-[#1a2b4a] rounded w-1/3" />
          <div className="h-3 bg-[#1a2b4a] rounded w-2/3" />
          <div className="h-4 bg-[#1a2b4a] rounded w-full" />
          <div className="h-8 bg-[#1a2b4a] rounded w-full" />
        </div>
      </div>
    );
  }

  if (!limitData) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
        <p className="text-sm text-slate-400">Unable to load usage data.</p>
      </div>
    );
  }

  const isUnlimited = limitData.limit === null;
  const used = limitData.used;
  const limit = limitData.limit || 0;
  const remaining = limitData.remaining;
  const pct = isUnlimited ? 100 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = !isUnlimited && pct >= 75 && pct < 100;
  const isAtLimit = !isUnlimited && remaining === 0;
  const isWarnZone = pct >= 75;

  const barColor = isAtLimit ? '#ef4444' : isWarnZone ? '#f59e0b' : '#14b8a6';

  const resetLabel = limitData.resetDate
    ? new Date(limitData.resetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Current Plan</p>
            <p className="text-base font-bold text-white">{limitData.planName}</p>
          </div>
          <Link
            href="/upgrade"
            className="px-3 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap"
          >
            Upgrade
          </Link>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-slate-300">
              Job Applications Used
            </p>
            <p className="text-sm font-bold text-white">
              {used}{isUnlimited ? '' : ` of ${limit}`}
            </p>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          {isUnlimited ? (
            <span className="text-slate-400">Unlimited applications</span>
          ) : remaining !== null && remaining > 0 ? (
            <span className="text-slate-400">
              {remaining} application{remaining !== 1 ? 's' : ''} remaining
            </span>
          ) : (
            <span className="text-red-400 font-semibold">Limit reached</span>
          )}
          <span className="text-slate-400">
            Resets {resetLabel}
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1a2b4a]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Job Access Level</p>
            <span className="text-xs font-semibold text-slate-200">{getGuardAccessLevel(limitData.planSlug)}</span>
          </div>
        </div>
      </div>

      {isAtLimit && (
        <div className="bg-red-500/10 border-t border-red-500/20 px-4 sm:px-6 py-3">
          <p className="text-xs text-red-400">
            You have reached your monthly application limit. Upgrade your plan to apply for more jobs.
          </p>
        </div>
      )}

      {isNearLimit && !isAtLimit && (
        <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 sm:px-6 py-3">
          <p className="text-xs text-amber-400">
            You have used most of your monthly applications. Upgrade now to access more opportunities.
          </p>
        </div>
      )}
    </div>
  );
}