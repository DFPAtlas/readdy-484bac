'use client';

import Link from 'next/link';
import { useState } from 'react';

interface OnboardingItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  href: string;
  priority: number;
}

interface OnboardingPanelProps {
  items: OnboardingItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  nextAction: { label: string; href: string } | null;
  trialDaysLeft: number | null;
  isTrialActive: boolean;
  subscriptionStatus: string;
  onDismiss: () => void;
  compact?: boolean;
}

export default function OnboardingPanel({
  items,
  progress,
  completedCount,
  totalCount,
  nextAction,
  trialDaysLeft,
  isTrialActive,
  subscriptionStatus,
  onDismiss,
  compact = false,
}: OnboardingPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (compact) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex-shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-[#1e2d4d]" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${progress * 1.01} 100`}
                strokeLinecap="round"
                className="text-teal-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white">
              {progress}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Setup Progress</h3>
              <span className="text-xs text-slate-500">{completedCount}/{totalCount}</span>
            </div>
            {nextAction && (
              <Link
                href={nextAction.href}
                className="text-xs text-teal-500 dark:text-teal-400 font-medium hover:underline truncate block cursor-pointer"
              >
                Next: {nextAction.label}
              </Link>
            )}
          </div>
          {isTrialActive && trialDaysLeft !== null && (
            <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
              {trialDaysLeft}d trial left
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-teal-50 to-slate-50 dark:from-[#0f1d30] dark:to-[#111d35] rounded-2xl border border-teal-200/50 dark:border-[#1e2d4d] shadow-sm p-6 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/20">
              <i className="ri-rocket-line text-teal-500 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to QuickGuard</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Complete these steps to get the most from your account
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <i className={expanded ? 'ri-arrow-up-s-line text-xl' : 'ri-arrow-down-s-line text-xl'}></i>
            </button>
            <button
              onClick={onDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-[#1e2d4d]" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${progress * 1.01} 100`}
                strokeLinecap="round"
                className="text-teal-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">
              {progress}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {completedCount === totalCount ? 'All done!' : `${completedCount} of ${totalCount} steps completed`}
              </p>
              <p className="text-xs text-slate-500">{totalCount - completedCount} remaining</p>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-[#1e2d4d] rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {isTrialActive && trialDaysLeft !== null && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-8 h-8 bg-violet-500/15 rounded-lg flex items-center justify-center">
              <i className="ri-gift-line text-violet-500 text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                Your trial is active — {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining
              </p>
              <p className="text-xs text-violet-500/70">
                {subscriptionStatus === 'trialing' ? 'No charges until your trial ends. Post jobs now and only pay after the trial.' : 'You can post jobs and hire guards immediately.'}
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 text-xs font-semibold bg-violet-500 text-white px-3 py-1.5 rounded-lg hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              View Plans
            </Link>
          </div>
        )}

        {nextAction && completedCount < totalCount && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <i className="ri-lightbulb-line text-amber-500 text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Recommended Next Step</p>
              <Link
                href={nextAction.href}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline truncate block cursor-pointer"
              >
                {nextAction.label}
              </Link>
            </div>
            <Link
              href={nextAction.href}
              className="shrink-0 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              Take Action
            </Link>
          </div>
        )}

        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  item.completed
                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : 'bg-white dark:bg-[#162036] border-slate-200 dark:border-[#1e2d4d] hover:border-teal-500/30 hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.completed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-[#0B1933] text-slate-500 dark:text-slate-400 group-hover:bg-teal-500/10 group-hover:text-teal-500'
                  }`}
                >
                  <i className={`${item.completed ? 'ri-check-line' : item.icon} text-sm`}></i>
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      item.completed ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">{item.description}</p>
                </div>
                {item.completed && (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Done
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}