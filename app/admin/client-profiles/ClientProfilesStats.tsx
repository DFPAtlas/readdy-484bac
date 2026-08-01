'use client';

interface StatsProps {
  total: number;
  verified: number;
  profileComplete: number;
  suspended: number;
  totalSpent: number;
}

export default function ClientProfilesStats({ total, verified, profileComplete, suspended, totalSpent }: StatsProps) {
  const stats = [
    {
      label: 'Total Clients',
      value: total,
      icon: 'ri-building-line',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300',
      sub: `${total > 0 ? Math.round((verified / total) * 100) : 0}% verified`,
    },
    {
      label: 'Verified',
      value: verified,
      icon: 'ri-checkbox-circle-line',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      textColor: 'text-emerald-300',
      sub: 'Verified accounts',
    },
    {
      label: 'Profile Complete',
      value: profileComplete,
      icon: 'ri-user-follow-line',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      textColor: 'text-purple-300',
      sub: `${total > 0 ? Math.round((profileComplete / total) * 100) : 0}% completion rate`,
    },
    {
      label: 'Suspended',
      value: suspended,
      icon: 'ri-forbid-line',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      textColor: 'text-red-300',
      sub: 'Restricted accounts',
    },
    {
      label: 'Total Revenue',
      value: `£${totalSpent.toLocaleString()}`,
      icon: 'ri-money-pound-circle-line',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      textColor: 'text-amber-300',
      sub: 'From all clients',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 flex items-center justify-center ${s.iconBg} rounded-lg`}>
              <i className={`${s.icon} text-xl ${s.iconColor}`}></i>
            </div>
            <span className={`text-sm font-medium ${s.textColor}`}>{s.label}</span>
          </div>
          <p className="text-3xl font-bold text-white">{s.value}</p>
          <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}