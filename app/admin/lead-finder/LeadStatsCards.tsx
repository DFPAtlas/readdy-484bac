'use client';

interface Stats {
  total: number;
  newThisWeek: number;
  highScore: number;
  withEmail: number;
  optedOut: number;
}

interface Props {
  stats: Stats;
}

export default function LeadStatsCards({ stats }: Props) {
  const cards = [
    { label: 'Total Leads', value: stats.total, icon: 'ri-user-search-line', color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
    { label: 'New This Week', value: stats.newThisWeek, icon: 'ri-fire-line', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    { label: 'High Score (80+)', value: stats.highScore, icon: 'ri-trophy-line', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    { label: 'With Email', value: stats.withEmail, icon: 'ri-mail-line', color: 'text-sky-400', bgColor: 'bg-sky-500/10' },
    { label: 'Opted Out', value: stats.optedOut, icon: 'ri-forbid-2-line', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1a2b4a] hover:shadow-md hover:border-[#243a5e] transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</p>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bgColor}`}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${c.icon} ${c.color} text-lg`}></i>
              </div>
            </div>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}