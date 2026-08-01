'use client';

interface BusinessOverviewProps {
  activeJobs: number;
  totalGuardsHired: number;
  totalSpendThisMonth: number;
  averageFillTime: number;
  completedThisMonth: number;
  loading?: boolean;
}

export default function BusinessOverview({
  activeJobs,
  totalGuardsHired,
  totalSpendThisMonth,
  averageFillTime,
  completedThisMonth,
  loading = false,
}: BusinessOverviewProps) {
  const metrics = [
    {
      label: 'Active Jobs',
      value: activeJobs,
      icon: 'ri-briefcase-4-line',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-500',
      suffix: '',
    },
    {
      label: 'Total Guards Hired',
      value: totalGuardsHired,
      icon: 'ri-shield-user-line',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-500',
      suffix: '',
    },
    {
      label: 'Total Spend This Month',
      value: `£${totalSpendThisMonth.toFixed(2)}`,
      icon: 'ri-wallet-3-line',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-500',
      suffix: '',
    },
    {
      label: 'Average Fill Time',
      value: `${averageFillTime}h`,
      icon: 'ri-time-line',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-500',
      suffix: '',
    },
    {
      label: 'Completed This Month',
      value: completedThisMonth,
      icon: 'ri-check-double-line',
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-500',
      suffix: '',
    },
  ];

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6 mb-6">
        <div className="h-5 bg-[#1a2b4a] rounded w-36 mb-4 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#1a2b4a] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6 mb-6">
      <h2 className="text-base font-semibold text-white mb-4">Business Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-[#162036] rounded-xl border border-[#1a2b4a] p-4 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 ${m.iconBg} rounded-lg flex items-center justify-center mb-3`}>
              <i className={`${m.icon} text-lg ${m.iconColor}`} />
            </div>
            <p className="text-xl font-bold text-white">{m.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}