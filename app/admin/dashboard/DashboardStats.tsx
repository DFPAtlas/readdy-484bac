'use client';

interface KpiItem {
  label: string;
  value: string;
  icon: string;
  color: string;
  bgColor: string;
  trend: string | null;
  trendUp: boolean | null;
  href: string;
}

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  pendingVerifications: number;
  failedPayments: number;
  activeSubscriptions: number;
  trialAccounts: number;
  incompleteProfiles: number;
  openSupportTickets: number;
  newUsersThisMonth: number;
  monthlyRevenue: number;
  loading: boolean;
  error?: string | null;
}

function SkeletonCard() {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1a2b4a] animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#1a2b4a]"></div>
        <div className="w-16 h-6 rounded-full bg-[#1a2b4a]"></div>
      </div>
      <div className="w-20 h-8 bg-[#1a2b4a] rounded mb-2"></div>
      <div className="w-24 h-4 bg-[#1a2b4a] rounded"></div>
    </div>
  );
}

function LivePulse() {
  return (
    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20 animate-pulse" title="Live data"></span>
  );
}

function EmptyStats() {
  return (
    <div className="col-span-full bg-[#111d35] rounded-2xl p-10 shadow-sm border border-[#1a2b4a] text-center">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#1a2b4a] text-slate-500 mx-auto mb-4">
        <i className="ri-bar-chart-grouped-line text-3xl"></i>
      </div>
      <h3 className="text-base font-semibold text-slate-400 mb-1">No data yet</h3>
      <p className="text-sm text-slate-500">Dashboard stats will appear once users and activity are added.</p>
    </div>
  );
}

function ErrorStats({ error }: { error: string }) {
  return (
    <div className="col-span-full bg-[#111d35] rounded-2xl p-10 shadow-sm border border-red-500/30 text-center">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mx-auto mb-4">
        <i className="ri-error-warning-line text-3xl"></i>
      </div>
      <h3 className="text-base font-semibold text-red-400 mb-1">Failed to load stats</h3>
      <p className="text-sm text-red-400/70">{error}</p>
    </div>
  );
}

export default function DashboardStats({
  pendingVerifications,
  failedPayments,
  activeSubscriptions,
  trialAccounts,
  incompleteProfiles,
  openSupportTickets,
  newUsersThisMonth,
  monthlyRevenue,
  loading,
  error,
}: Props) {
  const data: KpiItem[] = [
    {
      label: 'Pending Verifications',
      value: formatNumber(pendingVerifications),
      icon: 'ri-shield-check-line',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      trend: pendingVerifications > 0 ? 'Action needed' : null,
      trendUp: null,
      href: '/admin/guard-verifications',
    },
    {
      label: 'Failed Payments',
      value: formatNumber(failedPayments),
      icon: 'ri-close-circle-line',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      trend: failedPayments > 0 ? 'Requires review' : null,
      trendUp: null,
      href: '/admin/failed-payments',
    },
    {
      label: 'Active Subscriptions',
      value: formatNumber(activeSubscriptions),
      icon: 'ri-vip-crown-line',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      trend: null,
      trendUp: null,
      href: '/admin/subscription-management',
    },
    {
      label: 'Trial Accounts',
      value: formatNumber(trialAccounts),
      icon: 'ri-flask-line',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      trend: null,
      trendUp: null,
      href: '/admin/accounts',
    },
    {
      label: 'Incomplete Profiles',
      value: formatNumber(incompleteProfiles),
      icon: 'ri-user-unfollow-line',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      trend: incompleteProfiles > 0 ? 'Action needed' : null,
      trendUp: null,
      href: '/admin/guard-verifications',
    },
    {
      label: 'Open Support Tickets',
      value: formatNumber(openSupportTickets),
      icon: 'ri-customer-service-2-line',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      trend: openSupportTickets > 0 ? 'Action needed' : null,
      trendUp: null,
      href: '/admin/complaints',
    },
    {
      label: 'New Users This Month',
      value: formatNumber(newUsersThisMonth),
      icon: 'ri-user-add-line',
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      trend: newUsersThisMonth > 0 ? 'New signups' : null,
      trendUp: null,
      href: '/admin/accounts',
    },
    {
      label: 'Revenue This Month',
      value: formatCurrency(monthlyRevenue),
      icon: 'ri-money-pound-circle-line',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      trend: null,
      trendUp: null,
      href: '/admin/revenue-forecast',
    },
  ];

  return (
    <section aria-label="Key Performance Indicators">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {error
          ? <ErrorStats error={error} />
          : loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
          : data.length === 0 || data.every((k) => k.value === '0' || k.value === '£0')
          ? <EmptyStats />
          : data.map((kpi) => (
              <a
                key={kpi.label}
                href={kpi.href}
                className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1a2b4a] hover:shadow-md hover:border-[#243a5e] transition-all duration-200 group relative block"
              >
                <LivePulse />
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kpi.bgColor}`}>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${kpi.icon} ${kpi.color} text-lg`}></i>
                    </div>
                  </div>
                  {kpi.trend && (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        kpi.trend === 'Action needed'
                          ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                          : kpi.trend === 'Requires review'
                          ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                          : 'bg-[#1a2b4a] text-slate-400 ring-1 ring-[#1a2b4a]'
                      }`}
                    >
                      {kpi.trend}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-extrabold text-white mb-1 tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-sm font-medium text-slate-400">{kpi.label}</div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-teal-400 transition-colors">
                  <span>View details</span>
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-arrow-right-line"></i>
                  </div>
                </div>
              </a>
            ))}
      </div>
    </section>
  );
}