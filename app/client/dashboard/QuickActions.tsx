import Link from 'next/link';

const actions = [
  {
    href: '/client/templates',
    icon: 'ri-file-copy-line',
    label: 'Templates',
    desc: 'Saved job configurations',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-indigo-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/sites',
    icon: 'ri-building-line',
    label: 'Saved Sites',
    desc: 'Manage regular sites for quick reuse',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-cyan-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/profile',
    icon: 'ri-rocket-line',
    label: 'Account Setup',
    desc: 'Complete your profile and billing',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    iconColor: 'text-indigo-500',
    border: 'border-indigo-200 dark:border-indigo-500/20',
    hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-500/20',
  },
  {
    href: '/client/post-job',
    icon: 'ri-add-circle-line',
    label: 'Post a Job',
    desc: 'Create a new security job posting',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-teal-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/jobs',
    icon: 'ri-briefcase-4-line',
    label: 'Manage Jobs',
    desc: 'View and manage your postings',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-emerald-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/payment-history',
    icon: 'ri-receipt-line',
    label: 'View Invoices',
    desc: 'Check payment history & receipts',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-violet-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/trust-safety',
    icon: 'ri-shield-check-line',
    label: 'Trust & Safety',
    desc: 'Safety, compliance & emergency contacts',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-teal-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/reports',
    icon: 'ri-file-chart-line',
    label: 'Reports',
    desc: 'Download job, payment & compliance reports',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-blue-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/reviews',
    icon: 'ri-star-line',
    label: 'Reviews',
    desc: 'Rate guards and view feedback',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-amber-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/notifications',
    icon: 'ri-notification-3-line',
    label: 'Notifications',
    desc: 'Alerts and updates',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-amber-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
  {
    href: '/client/support',
    icon: 'ri-customer-service-2-line',
    label: 'Support',
    desc: 'Help centre and tickets',
    bg: 'bg-slate-100 dark:bg-[#162036]',
    iconColor: 'text-rose-400',
    border: 'border-slate-200 dark:border-[#1e2d4d]',
    hover: 'hover:bg-slate-200 dark:hover:bg-[#1a2642]',
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex items-center gap-3 p-3 rounded-xl border ${a.bg} ${a.border} ${a.hover} transition-all cursor-pointer group`}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-[#0B1933] shadow-sm">
              <i className={`${a.icon} text-xl ${a.iconColor}`}></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.label}</p>
              <p className="text-xs text-slate-500 leading-tight">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}