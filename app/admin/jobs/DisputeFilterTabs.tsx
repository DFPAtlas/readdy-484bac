'use client';

interface DisputeFilterTabsProps {
  filter: string;
  onFilterChange: (filter: string) => void;
  openCount: number;
  resolvedCount: number;
  totalDisputedAmount: number;
}

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'resolved', label: 'Resolved' },
];

export default function DisputeFilterTabs({ filter, onFilterChange, openCount, resolvedCount, totalDisputedAmount }: DisputeFilterTabsProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-xl font-bold text-white">Disputes</h2>
        <p className="text-sm text-slate-400 mt-1">
          {openCount} open / {resolvedCount} resolved / £{totalDisputedAmount.toFixed(2)} held
        </p>
      </div>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onFilterChange(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              filter === t.key
                ? 'bg-teal-500 text-white'
                : 'bg-[#111d35] text-slate-400 hover:bg-[#1a2642]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}