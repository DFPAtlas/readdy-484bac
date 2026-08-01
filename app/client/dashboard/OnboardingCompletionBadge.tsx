'use client';

import { useState } from 'react';

interface OnboardingCompletionBadgeProps {
  progress: number;
  completedCount: number;
  totalCount: number;
}

export default function OnboardingCompletionBadge({
  progress,
  completedCount,
  totalCount,
}: OnboardingCompletionBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (progress < 100) return null;

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <i className="ri-check-double-line text-emerald-500 text-lg"></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Account setup complete
          </p>
          <p className="text-xs text-slate-500">
            {completedCount}/{totalCount} steps done
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-teal-500 dark:text-teal-400 font-medium hover:underline cursor-pointer whitespace-nowrap"
        >
          {showDetails ? 'Hide' : 'Show Details'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#1e2d4d] grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Company profile', icon: 'ri-building-line', done: true },
            { label: 'Billing details', icon: 'ri-bank-card-line', done: true },
            { label: 'Site contacts', icon: 'ri-contacts-line', done: true },
            { label: 'Notifications', icon: 'ri-notification-3-line', done: true },
            { label: 'First job', icon: 'ri-briefcase-line', done: true },
            { label: 'Account verified', icon: 'ri-shield-check-line', done: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs text-slate-500">
              <i className={`${item.icon} w-4 h-4 flex items-center justify-center text-emerald-500`}></i>
              <span>{item.label}</span>
              <i className="ri-check-line text-emerald-500 ml-auto"></i>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}