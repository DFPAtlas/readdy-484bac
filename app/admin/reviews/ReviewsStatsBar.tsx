'use client';

interface Props {
  total: number;
  avgRating: number;
  published: number;
  hidden: number;
  fiveStar: number;
}

export default function ReviewsStatsBar({ total, avgRating, published, hidden, fiveStar }: Props) {
  const stats = [
    { label: 'Total Reviews', value: total, icon: 'ri-star-line', accent: 'text-sky-400 bg-sky-500/10 ring-sky-500/20' },
    { label: 'Avg Rating', value: avgRating.toFixed(1) + ' / 5', icon: 'ri-star-fill', accent: 'text-amber-400 bg-amber-500/10 ring-amber-500/20' },
    { label: 'Published', value: published, icon: 'ri-eye-line', accent: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
    { label: 'Hidden', value: hidden, icon: 'ri-eye-off-line', accent: 'text-red-400 bg-red-500/10 ring-red-500/20' },
    { label: '5-Star Reviews', value: fiveStar, icon: 'ri-award-line', accent: 'text-violet-400 bg-violet-500/10 ring-violet-500/20' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-[#111d35] rounded-xl ring-1 ring-[#1a2b4a] p-4 flex items-center gap-3">
          <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${s.accent}`}>
            <i className={`${s.icon} text-lg`}></i>
          </div>
          <div>
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}