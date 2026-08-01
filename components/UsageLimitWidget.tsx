'use client';

import Link from 'next/link';

interface UsageLimitWidgetProps {
  featureLabel: string;
  icon: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  planName: string;
  periodEnd: string;
  audience: 'guard' | 'client';
  compact?: boolean;
}

export default function UsageLimitWidget({
  featureLabel,
  icon,
  limit,
  used,
  remaining,
  planName,
  periodEnd,
  audience,
  compact = false,
}: UsageLimitWidgetProps) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(Math.round((used / (limit || 1)) * 100), 100);
  const isNearLimit = !isUnlimited && pct >= 80 && pct < 100;
  const isAtLimit = !isUnlimited && pct >= 100;
  const upgradeReason = audience === 'guard' ? 'guard_application_limit_reached' : 'job_limit_reached';

  const barColor = isAtLimit
    ? 'bg-red-500'
    : isNearLimit
    ? 'bg-amber-500'
    : 'bg-teal-500';

  const textColor = isAtLimit
    ? 'text-red-400'
    : isNearLimit
    ? 'text-amber-400'
    : 'text-teal-400';

  const borderColor = isAtLimit
    ? 'border-red-500/25'
    : isNearLimit
    ? 'border-amber-500/25'
    : 'border-teal-500/25';

  const bgColor = isAtLimit
    ? 'bg-red-500/10'
    : isNearLimit
    ? 'bg-amber-500/10'
    : 'bg-teal-500/10';

  if (compact) {
    return (
      <div className={`${bgColor} border ${borderColor} rounded-xl p-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 ${bgColor} rounded-lg flex items-center justify-center`}>
              <i className={`${icon} ${textColor} text-sm`}></i>
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{featureLabel}</span>
          </div>
          {isUnlimited ? (
            <span className="text-xs font-bold text-teal-400">Unlimited</span>
          ) : (
            <span className={`text-xs font-bold ${textColor}`}>{used}/{limit}</span>
          )}
        </div>
        {!isUnlimited && (
          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#162036] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center`}>
            <i className={`${icon} text-xl ${textColor}`}></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{featureLabel}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{planName} Plan</p>
          </div>
        </div>
        {isAtLimit && (
          <Link
            href={`/upgrade?reason=${upgradeReason}`}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            Upgrade
          </Link>
        )}
        {isNearLimit && (
          <Link
            href={`/upgrade?reason=${upgradeReason}`}
            className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors whitespace-nowrap"
          >
            Upgrade
          </Link>
        )}
      </div>

      {isUnlimited ? (
        <div className={`${bgColor} rounded-xl p-4 text-center border ${borderColor}`}>
          <i className={`ri-infinity-line text-2xl ${textColor}`}></i>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No monthly limit</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Resets {new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className={`text-2xl font-bold ${isAtLimit ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>{remaining}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">remaining</span>
            </div>
            <span className={`text-sm font-semibold ${textColor}`}>{used} / {limit} used</span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-[#162036] rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{pct}% used</span>
            <span>Resets {new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </div>
        </>
      )}

      {isAtLimit && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-xs text-red-400 font-medium">
            You've reached your monthly limit. Upgrade to {audience === 'guard' ? 'apply for more jobs' : 'post more jobs'}.
          </p>
        </div>
      )}
      {isNearLimit && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <p className="text-xs text-amber-400 font-medium">
            You're almost at your limit. Consider upgrading to avoid interruption.
          </p>
        </div>
      )}
    </div>
  );
}