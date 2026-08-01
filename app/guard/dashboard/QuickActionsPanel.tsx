'use client';

import Link from 'next/link';

interface QuickAction {
  label: string;
  href: string;
  icon: string;
  color: string;
  glowColor: string;
}

const actions: QuickAction[] = [
  { label: 'Browse Jobs', href: '/guard/jobs', icon: 'ri-briefcase-line', color: 'text-teal-400', glowColor: 'group-hover:shadow-teal-500/20' },
  { label: 'Messages', href: '/guard/messages', icon: 'ri-message-3-line', color: 'text-blue-400', glowColor: 'group-hover:shadow-blue-500/20' },
  { label: 'Profile', href: '/guard/profile', icon: 'ri-user-settings-line', color: 'text-amber-400', glowColor: 'group-hover:shadow-amber-500/20' },
  { label: 'Earnings', href: '/guard/earnings', icon: 'ri-money-pound-circle-line', color: 'text-emerald-400', glowColor: 'group-hover:shadow-emerald-500/20' },
  { label: 'Invites', href: '/guard/job-invites', icon: 'ri-mail-send-line', color: 'text-violet-400', glowColor: 'group-hover:shadow-violet-500/20' },
  { label: 'Support', href: '/contact', icon: 'ri-customer-service-2-line', color: 'text-slate-300', glowColor: 'group-hover:shadow-slate-500/20' },
];

export default function QuickActionsPanel() {
  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-lg p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-flashlight-line text-teal-400"></i>
        </div>
        Quick Actions
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`group flex flex-col items-center gap-2 rounded-2xl border border-[#1a2b4a] bg-[#0B1933] p-3 sm:p-4 hover:border-[#2a3e5f] hover:shadow-lg ${action.glowColor} hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#111d35] border border-[#1a2b4a] flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
              <i className={`${action.icon} ${action.color} text-lg sm:text-xl`}></i>
            </div>
            <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors text-center leading-tight whitespace-nowrap">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}