'use client';

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  open: { label: 'Open', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', dot: 'bg-red-500' },
  awaiting_client: { label: 'Awaiting Client', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', dot: 'bg-amber-400' },
  awaiting_guard: { label: 'Awaiting Guard', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', dot: 'bg-violet-500' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', dot: 'bg-slate-500' },
  escalated: { label: 'Escalated', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', dot: 'bg-orange-500' },
};

export default function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  const config = statusConfig[status] || statusConfig.open;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.bg} ${config.text} ${config.border} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}>
      <span className={`${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return statusConfig[status]?.label || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}