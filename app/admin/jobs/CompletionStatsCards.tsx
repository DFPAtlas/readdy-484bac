'use client';

interface CompletionStatsCardsProps {
  counts: { all: number; pending: number; approved: number; disputed: number };
  filter: string;
  onFilterChange: (filter: string) => void;
}

const stats = [
  { key: 'all', label: 'All', ring: 'ring-[#1e2d4d]', bg: 'bg-[#111d35]', text: 'text-slate-400' },
  { key: 'pending', label: 'Pending', ring: 'ring-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { key: 'approved', label: 'Approved', ring: 'ring-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { key: 'disputed', label: 'Disputed', ring: 'ring-orange-500/20', bg: 'bg-orange-500/10', text: 'text-orange-400' },
];

export default function CompletionStatsCards({ counts, filter, onFilterChange }: CompletionStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <button
          key={s.key}
          onClick={() => onFilterChange(s.key)}
          className={`rounded-xl ring-1 px-3 py-3 text-center transition-all cursor-pointer ${s.ring} ${s.bg} ${s.text} ${
            filter === s.key ? 'ring-2 shadow-sm' : ''
          }`}
        >
          <p className="text-xl font-extrabold">{counts[s.key as keyof typeof counts]}</p>
          <p className="text-xs font-semibold mt-0.5">{s.label}</p>
        </button>
      ))}
    </div>
  );
}