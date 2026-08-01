'use client';

interface Stats {
  loginsToday: number;
  failedLogins: number;
  resetsToday: number;
  uniqueAdmins: number;
}

export default function SecurityStatsBar({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: 'Logins Today',
      value: stats.loginsToday,
      icon: 'ri-login-box-line',
      iconBg: 'bg-sky-500/10',
      iconColor: 'text-sky-400',
      valueColor: 'text-white',
    },
    {
      label: 'Failed Logins',
      value: stats.failedLogins,
      icon: 'ri-lock-password-line',
      iconBg: stats.failedLogins > 0 ? 'bg-red-500/10' : 'bg-slate-500/10',
      iconColor: stats.failedLogins > 0 ? 'text-red-400' : 'text-slate-500',
      valueColor: stats.failedLogins > 0 ? 'text-red-400' : 'text-slate-300',
    },
    {
      label: 'Password Resets Today',
      value: stats.resetsToday,
      icon: 'ri-key-2-line',
      iconBg: stats.resetsToday > 0 ? 'bg-amber-500/10' : 'bg-slate-500/10',
      iconColor: stats.resetsToday > 0 ? 'text-amber-400' : 'text-slate-500',
      valueColor: stats.resetsToday > 0 ? 'text-amber-400' : 'text-slate-300',
    },
    {
      label: 'Unique Admins (All Time)',
      value: stats.uniqueAdmins,
      icon: 'ri-user-star-line',
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-400',
      valueColor: 'text-white',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 hover:border-teal-500/30 transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-400">{card.label}</p>
            <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${card.iconBg}`}>
              <i className={`${card.icon} text-lg ${card.iconColor}`}></i>
            </div>
          </div>
          <p className={`text-3xl font-bold ${card.valueColor}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}