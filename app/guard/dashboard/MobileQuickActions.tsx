'use client';

import Link from 'next/link';

interface Props {
  onNavigate?: (hash: string) => void;
}

const ACTIONS = [
  { label: 'Find Jobs', icon: 'ri-briefcase-line', href: '/jobs', isHash: false },
  { label: 'My Applications', icon: 'ri-send-plane-line', href: '#applications', isHash: true },
  { label: 'Upcoming Shifts', icon: 'ri-calendar-line', href: '#upcoming', isHash: true },
  { label: 'Messages', icon: 'ri-message-3-line', href: '#responses', isHash: true },
  { label: 'Profile', icon: 'ri-user-line', href: '/guard/profile', isHash: false },
];

export default function MobileQuickActions({ onNavigate }: Props) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#111d35] border-t border-slate-200 dark:border-[#1e2d4d] z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center py-2">
        {ACTIONS.map(action => {
          const content = (
            <div className="flex flex-col items-center gap-1 px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${action.icon} text-lg`}></i>
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap">{action.label}</span>
            </div>
          );
          if (action.isHash) {
            return (
              <button
                key={action.label}
                onClick={() => onNavigate?.(action.href)}
                className="flex flex-col items-center gap-1 px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`${action.icon} text-lg`}></i>
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap">{action.label}</span>
              </button>
            );
          }
          return (
            <Link key={action.label} href={action.href} className="flex flex-col items-center gap-1 px-2 py-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}