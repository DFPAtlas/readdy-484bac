'use client';

import type { DashboardFailure } from '@/lib/admin-dashboard-stats';

interface Props {
  failures: DashboardFailure[];
  lastSuccessAt: Date | null;
  retrying: boolean;
  onRetry: () => void;
}

export default function DashboardUnavailable({ failures, lastSuccessAt, retrying, onRetry }: Props) {
  const visible = failures.slice(0, 4);
  const hidden = failures.length - visible.length;

  return (
    <section
      aria-label="Dashboard metrics unavailable"
      aria-live="polite"
      className="rounded-2xl border border-red-500/30 bg-[#111d35] p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
          <i className="ri-signal-tower-line text-lg"></i>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white">Dashboard metrics unavailable</h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Live figures, alerts and control-centre health are hidden until the dashboard data loads
            successfully. Nothing is being reported as zero or healthy while it is unavailable.
          </p>
          <ul className="mt-3 space-y-1.5">
            {visible.map((item) => (
              <li key={`${item.key}-${item.message}`} className="text-xs text-slate-400 flex items-start gap-2">
                <i className="ri-close-circle-line text-red-400 mt-0.5"></i>
                <span className="min-w-0">
                  <span className="font-semibold text-slate-300">{item.label}:</span> {item.message}
                </span>
              </li>
            ))}
            {hidden > 0 && (
              <li className="text-xs text-slate-500">+{hidden} more metric group{hidden > 1 ? 's' : ''} failed</li>
            )}
          </ul>
          <p className="text-xs text-slate-500 mt-3">
            {lastSuccessAt
              ? `Last successful sync: ${lastSuccessAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. Those values are treated as stale and are not shown.`
              : 'No successful sync has completed since this page was opened.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all shadow-sm cursor-pointer disabled:opacity-60 flex-shrink-0 whitespace-nowrap"
        >
          <span className={`w-4 h-4 flex items-center justify-center ${retrying ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line text-sm"></i>
          </span>
          {retrying ? 'Retrying' : 'Retry'}
        </button>
      </div>
    </section>
  );
}