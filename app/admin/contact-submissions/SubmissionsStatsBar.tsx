'use client';

interface Stats {
  new: number;
  inProgress: number;
  resolved: number;
  archived: number;
  total: number;
}

interface Props {
  stats: Stats;
}

export default function SubmissionsStatsBar({ stats }: Props) {
  const cards = [
    { label: 'New', value: stats.new, icon: 'ri-mail-add-line', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'In Progress', value: stats.inProgress, icon: 'ri-loader-2-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Resolved', value: stats.resolved, icon: 'ri-check-double-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Archived', value: stats.archived, icon: 'ri-archive-line', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className={`bg-[#111d35] border ${c.border} rounded-2xl p-4`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</p>
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${c.bg}`}>
              <i className={`${c.icon} ${c.color} text-base`}></i>
            </div>
          </div>
          <p className={`text-2xl font-bold ${c.color}`} suppressHydrationWarning>{c.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">of {stats.total} total</p>
        </div>
      ))}
    </div>
  );
}