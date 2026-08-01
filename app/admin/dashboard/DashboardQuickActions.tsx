import Link from 'next/link';

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  href: string;
  accent: string;
}

const accentMap: Record<string, { icon: string; border: string; hover: string; btn: string; btnHover: string }> = {
  teal: { icon: 'bg-teal-500/10 text-teal-400', border: 'border-teal-500/20', hover: 'hover:border-teal-500/40 hover:shadow-teal-500/10', btn: 'bg-teal-600', btnHover: 'hover:bg-teal-500' },
  blue: { icon: 'bg-sky-500/10 text-sky-400', border: 'border-sky-500/20', hover: 'hover:border-sky-500/40 hover:shadow-sky-500/10', btn: 'bg-sky-600', btnHover: 'hover:bg-sky-500' },
  indigo: { icon: 'bg-indigo-500/10 text-indigo-400', border: 'border-indigo-500/20', hover: 'hover:border-indigo-500/40 hover:shadow-indigo-500/10', btn: 'bg-indigo-600', btnHover: 'hover:bg-indigo-500' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10', btn: 'bg-emerald-600', btnHover: 'hover:bg-emerald-500' },
  amber: { icon: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/20', hover: 'hover:border-amber-500/40 hover:shadow-amber-500/10', btn: 'bg-amber-500', btnHover: 'hover:bg-amber-400' },
  rose: { icon: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/20', hover: 'hover:border-rose-500/40 hover:shadow-rose-500/10', btn: 'bg-rose-600', btnHover: 'hover:bg-rose-500' },
  slate: { icon: 'bg-slate-500/10 text-slate-400', border: 'border-slate-500/20', hover: 'hover:border-slate-500/40 hover:shadow-slate-500/10', btn: 'bg-slate-600', btnHover: 'hover:bg-slate-500' },
  orange: { icon: 'bg-orange-500/10 text-orange-400', border: 'border-orange-500/20', hover: 'hover:border-orange-500/40 hover:shadow-orange-500/10', btn: 'bg-orange-500', btnHover: 'hover:bg-orange-400' },
};

const quickActions: QuickAction[] = [
  {
    title: 'Verify Guards',
    description: 'Review pending SIA licences and background checks.',
    icon: 'ri-shield-check-line',
    href: '/admin/guard-verifications',
    accent: 'teal',
  },
  {
    title: 'Manage Jobs',
    description: 'View, edit, and moderate all active and completed jobs.',
    icon: 'ri-briefcase-line',
    href: '/admin/jobs',
    accent: 'blue',
  },
  {
    title: 'Client Monitoring',
    description: 'Monitor client health, alerts, jobs, payments, and support tickets.',
    icon: 'ri-dashboard-line',
    href: '/admin/client-monitoring',
    accent: 'indigo',
  },
  {
    title: 'User Management',
    description: 'Manage guard and client accounts, permissions, and bans.',
    icon: 'ri-team-line',
    href: '/admin/accounts',
    accent: 'indigo',
  },
  {
    title: 'Financial Reports',
    description: 'View revenue, payouts, and platform commission analytics.',
    icon: 'ri-bar-chart-box-line',
    href: '/admin/revenue-forecast',
    accent: 'emerald',
  },
  {
    title: 'Support Tickets',
    description: 'Resolve client and guard support requests.',
    icon: 'ri-customer-service-2-line',
    href: '/admin/complaints',
    accent: 'rose',
  },
  {
    title: 'Promo Tiers',
    description: 'Manage Founding, Early & Launch Guard promo caps.',
    icon: 'ri-shield-star-line',
    href: '/admin/promo-tiers',
    accent: 'teal',
  },
  {
    title: 'Announcements',
    description: 'Broadcast messages to all users on their dashboards.',
    icon: 'ri-megaphone-line',
    href: '/admin/announcements',
    accent: 'amber',
  },
];

export default function DashboardQuickActions() {
  return (
    <section aria-labelledby="actions-heading">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a2b4a] text-slate-400">
            <i className="ri-apps-2-line text-lg"></i>
          </div>
          <h2 id="actions-heading" className="text-base font-bold text-white">
            Quick Actions
          </h2>
        </div>
        {quickActions.map((action) => {
          const style = accentMap[action.accent] || accentMap.teal;
          return (
            <Link
              key={action.title}
              href={action.href}
              className={`group block rounded-2xl border bg-[#111d35] p-5 transition-all duration-200 shadow-sm hover:shadow-md ${style.border} ${style.hover}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.icon}`}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className={`${action.icon} text-xl`}></i>
                  </div>
                </div>
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1a2b4a] text-slate-500 group-hover:bg-[#243a5e] group-hover:text-slate-300 transition-all">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-arrow-right-line text-sm"></i>
                  </div>
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}