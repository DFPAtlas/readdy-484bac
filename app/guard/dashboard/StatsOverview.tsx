'use client';

interface StatItem {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
}

const colorMap: Record<string, { bg: string; iconBg: string; text: string; border: string; glow: string }> = {
  teal: { bg: 'bg-teal-500/5', iconBg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/15', glow: 'shadow-teal-500/5' },
  blue: { bg: 'bg-blue-500/5', iconBg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/15', glow: 'shadow-blue-500/5' },
  emerald: { bg: 'bg-emerald-500/5', iconBg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/15', glow: 'shadow-emerald-500/5' },
  amber: { bg: 'bg-amber-500/5', iconBg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/15', glow: 'shadow-amber-500/5' },
  slate: { bg: 'bg-slate-500/5', iconBg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/15', glow: 'shadow-slate-500/5' },
  purple: { bg: 'bg-purple-500/5', iconBg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/15', glow: 'shadow-purple-500/5' },
  violet: { bg: 'bg-violet-500/5', iconBg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/15', glow: 'shadow-violet-500/5' },
};

interface Props {
  stats: StatItem[];
}

export default function StatsOverview({ stats }: Props) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat, i) => {
          const c = colorMap[stat.color] || colorMap.slate;
          return (
            <div
              key={i}
              className={`${c.bg} rounded-2xl border ${c.border} p-4 hover:shadow-lg ${c.glow} hover:-translate-y-0.5 transition-all duration-200 cursor-default`}
            >
              <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center mb-3`}>
                <i className={`${stat.icon} text-xl ${c.text}`}></i>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stat.value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-slate-500">{stat.label}</p>
                {stat.trend && (
                  <span className="text-xs text-slate-500">{stat.trend}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}