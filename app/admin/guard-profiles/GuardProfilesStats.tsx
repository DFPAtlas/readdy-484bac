'use client';

interface StatsData {
  total: number;
  siaVerified: number;
  approved: number;
  pending: number;
  rejected: number;
  inactive: number;
  totalEarnings: number;
  avgRating: number;
}

interface StatsProps {
  stats: StatsData;
}

export default function GuardProfilesStats({ stats }: StatsProps) {
  const { total, siaVerified, approved, pending, totalEarnings, avgRating } = stats;

  const items = [
    {
      label: 'Total Guards',
      value: total,
      icon: 'ri-shield-user-line',
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-400',
      textColor: 'text-teal-300',
      sub: `${total > 0 ? Math.round((approved / total) * 100) : 0}% approved`,
    },
    {
      label: 'SIA Verified',
      value: siaVerified,
      icon: 'ri-id-card-line',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300',
      sub: `${total > 0 ? Math.round((siaVerified / total) * 100) : 0}% of all guards`,
    },
    {
      label: 'Approved',
      value: approved,
      icon: 'ri-checkbox-circle-line',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      textColor: 'text-emerald-300',
      sub: 'Active & approved',
    },
    {
      label: 'Pending Review',
      value: pending,
      icon: 'ri-time-line',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      textColor: 'text-amber-300',
      sub: 'Awaiting verification',
    },
    {
      label: 'Avg Rating',
      value: avgRating > 0 ? avgRating.toFixed(1) : '—',
      icon: 'ri-star-line',
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-300',
      sub: 'Across all guards',
    },
    {
      label: 'Total Earnings',
      value: `£${totalEarnings.toLocaleString()}`,
      icon: 'ri-money-pound-circle-line',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      textColor: 'text-purple-300',
      sub: 'Paid out to guards',
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-4 mb-8">
      {items.map((s) => (
        <div key={s.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 flex items-center justify-center ${s.iconBg} rounded-lg`}>
              <i className={`${s.icon} text-lg ${s.iconColor}`}></i>
            </div>
            <span className={`text-xs font-medium ${s.textColor}`}>{s.label}</span>
          </div>
          <p className="text-2xl font-bold text-white">{s.value}</p>
          <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}