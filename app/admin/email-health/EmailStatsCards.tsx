'use client';

interface StatsCardsProps {
  total: number;
  sent: number;
  failed: number;
  templateCount: number;
  loading: boolean;
}

export default function EmailStatsCards({ total, sent, failed, templateCount, loading }: StatsCardsProps) {
  const cards = [
    { label: 'Total Emails', value: total, icon: 'ri-mail-send-line', color: 'teal' },
    { label: 'Delivered', value: sent, icon: 'ri-check-double-line', color: 'emerald' },
    { label: 'Failed', value: failed, icon: 'ri-close-circle-line', color: 'red' },
    { label: 'Templates Used', value: templateCount, icon: 'ri-file-list-3-line', color: 'violet' },
  ];

  const colorMap: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    violet: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-[#111d35] rounded-2xl p-5 border border-[#1a2b4a]">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[card.color]}`}>
              <i className={`${card.icon} text-lg`}></i>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{card.label}</p>
              {loading ? (
                <div className="h-7 w-12 bg-slate-700/50 rounded animate-pulse mt-0.5"></div>
              ) : (
                <p className="text-2xl font-bold text-white">{card.value}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}