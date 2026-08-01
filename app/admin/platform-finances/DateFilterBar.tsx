'use client';

const options = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom Range', value: 'custom' },
];

interface Props {
  active: string;
  onChange: (value: string) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
}

export default function DateFilterBar({ active, onChange, customStart, customEnd, onCustomStartChange, onCustomEndChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
            active === o.value
              ? 'bg-teal-500 text-white shadow-sm'
              : 'bg-[#111d35] border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
      {active === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart || ''}
            onChange={(e) => onCustomStartChange?.(e.target.value)}
            className="px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={(e) => onCustomEndChange?.(e.target.value)}
            className="px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
}