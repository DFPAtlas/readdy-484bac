'use client';

interface StatsProps {
  totalClients: number;
  newClientsThisMonth: number;
  trialClients: number;
  activePayingClients: number;
  clientsWithFailedPayments: number;
  clientsWithOpenTickets: number;
  clientsWithJobsStartingSoon: number;
}

export default function ClientMonitoringStats({
  totalClients,
  newClientsThisMonth,
  trialClients,
  activePayingClients,
  clientsWithFailedPayments,
  clientsWithOpenTickets,
  clientsWithJobsStartingSoon,
}: StatsProps) {
  const stats = [
    {
      label: 'Total Clients',
      value: totalClients,
      icon: 'ri-building-line',
      bg: 'bg-slate-50',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      textColor: 'text-slate-700',
      sub: 'All registered clients',
    },
    {
      label: 'New This Month',
      value: newClientsThisMonth,
      icon: 'ri-user-add-line',
      bg: 'bg-teal-50',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      textColor: 'text-teal-700',
      sub: 'Recent sign-ups',
    },
    {
      label: 'Trial Clients',
      value: trialClients,
      icon: 'ri-timer-line',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-700',
      sub: 'On trial period',
    },
    {
      label: 'Active Paying',
      value: activePayingClients,
      icon: 'ri-vip-crown-line',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-700',
      sub: 'Subscribed & active',
    },
    {
      label: 'Failed Payments',
      value: clientsWithFailedPayments,
      icon: 'ri-error-warning-line',
      bg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      textColor: 'text-red-700',
      sub: 'Needs attention',
    },
    {
      label: 'Open Tickets',
      value: clientsWithOpenTickets,
      icon: 'ri-message-3-line',
      bg: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      textColor: 'text-orange-700',
      sub: 'Support issues',
    },
    {
      label: 'Jobs Starting Soon',
      value: clientsWithJobsStartingSoon,
      icon: 'ri-calendar-check-line',
      bg: 'bg-sky-50',
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-600',
      textColor: 'text-sky-700',
      sub: 'Within 48 hours',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`${s.bg} border border-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 flex items-center justify-center ${s.iconBg} rounded-xl`}>
              <i className={`${s.icon} text-xl ${s.iconColor}`}></i>
            </div>
            <span className={`text-sm font-medium ${s.textColor}`}>{s.label}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{s.value}</p>
          <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}