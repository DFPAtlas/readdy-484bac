'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Guard, JobApplication, JobAssignment } from './types';

interface Props {
  guard: Guard | null;
  unreadCount: number;
  applications: JobApplication[];
  upcomingJobs: JobAssignment[];
  bankDetails: any;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  link: string;
  linkLabel: string;
}

export default function ActionRequiredPanel({ guard, unreadCount, applications, upcomingJobs, bankDetails }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().split('T')[0];

  const actions: ActionItem[] = [];

  if (!guard?.profile_completed) {
    actions.push({
      id: 'profile', title: 'Complete Your Profile', description: 'Add your details to get discovered and hired faster',
      icon: 'ri-user-line', color: 'blue', link: '/guard/profile', linkLabel: 'Complete Profile',
    });
  }

  if (!guard?.sia_licence_front_url) {
    actions.push({
      id: 'sia-upload', title: 'Upload SIA Licence', description: 'Required for verification — without it you cannot apply for jobs',
      icon: 'ri-id-card-line', color: 'amber', link: '/guard/profile', linkLabel: 'Upload Licence',
    });
  }

  if (guard?.sia_expiry_date) {
    const days = Math.floor((new Date(guard.sia_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 30 && days >= 0) {
      actions.push({
        id: 'sia-expire', title: 'SIA Licence Expiring Soon', description: `Your SIA licence expires in ${days} day${days !== 1 ? 's' : ''} — renew now to avoid disruption`,
        icon: 'ri-time-line', color: 'red', link: '/guard/profile', linkLabel: 'Renew Now',
      });
    }
  }

  if (!bankDetails) {
    actions.push({
      id: 'bank', title: 'Add Bank Details', description: 'Set up your payout method to receive earnings from completed jobs',
      icon: 'ri-bank-line', color: 'red', link: '/guard/bank-settings', linkLabel: 'Add Details',
    });
  }

  if (unreadCount > 0) {
    actions.push({
      id: 'messages', title: `${unreadCount} Unread Message${unreadCount > 1 ? 's' : ''}`, description: 'You have new responses from clients waiting for you',
      icon: 'ri-message-3-line', color: 'violet', link: '/guard/dashboard#responses', linkLabel: 'View Messages',
    });
  }

  const visibleActions = actions.filter(a => !dismissed.has(a.id));
  if (visibleActions.length === 0) return null;

  const colorStyles: Record<string, { bg: string; border: string; iconBg: string; text: string; btnBg: string; btnHover: string }> = {
    blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/15', iconBg: 'bg-blue-500/10', text: 'text-blue-400', btnBg: 'bg-blue-500/15', btnHover: 'hover:bg-blue-500/25' },
    amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/15', iconBg: 'bg-amber-500/10', text: 'text-amber-400', btnBg: 'bg-amber-500/15', btnHover: 'hover:bg-amber-500/25' },
    red: { bg: 'bg-red-500/5', border: 'border-red-500/15', iconBg: 'bg-red-500/10', text: 'text-red-400', btnBg: 'bg-red-500/15', btnHover: 'hover:bg-red-500/25' },
    violet: { bg: 'bg-violet-500/5', border: 'border-violet-500/15', iconBg: 'bg-violet-500/10', text: 'text-violet-400', btnBg: 'bg-violet-500/15', btnHover: 'hover:bg-violet-500/25' },
    emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', iconBg: 'bg-emerald-500/10', text: 'text-emerald-400', btnBg: 'bg-emerald-500/15', btnHover: 'hover:bg-emerald-500/25' },
  };

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Needs Attention</h2>
      {visibleActions.map(action => {
        const c = colorStyles[action.color] || colorStyles.blue;
        return (
          <div key={action.id} className={`${c.bg} border ${c.border} rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all hover:shadow-lg`}>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
              <i className={`${action.icon} text-xl ${c.text}`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white mb-0.5">{action.title}</h3>
              <p className="text-xs text-slate-400">{action.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={action.link}
                className={`px-4 py-2 ${c.btnBg} ${c.text} ${c.btnHover} rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer`}
              >
                {action.linkLabel}
              </Link>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, action.id]))}
                className="w-9 h-9 rounded-xl border border-[#1e2d4d] text-slate-500 hover:text-slate-300 hover:bg-[#162036] transition-all flex items-center justify-center cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}