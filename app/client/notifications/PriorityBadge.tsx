'use client';

interface PriorityBadgeProps {
  priority: number | string;
  size?: 'sm' | 'md';
}

const config: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
  '0': { label: 'Info', bg: 'bg-slate-500/10', color: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' },
  '1': { label: 'Normal', bg: 'bg-blue-500/10', color: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  '2': { label: 'Important', bg: 'bg-amber-500/10', color: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  '3': { label: 'Urgent', bg: 'bg-red-500/10', color: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
};

export default function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const key = String(priority || '1');
  const c = config[key] || config['1'];
  const base = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${c.bg} ${c.color} ${c.border} ${base}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}