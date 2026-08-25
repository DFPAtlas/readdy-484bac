'use client';

const priorityConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  low: { label: 'Low', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', icon: 'ri-arrow-down-line' },
  normal: { label: 'Normal', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', icon: 'ri-arrow-right-line' },
  high: { label: 'High', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-arrow-up-line' },
  urgent: { label: 'Urgent', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', icon: 'ri-fire-line' },
};

export default function PriorityBadge({ priority, compact }: { priority: string; compact?: boolean }) {
  const config = priorityConfig[priority] || priorityConfig.normal;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border ${config.bg} ${config.text} ${config.border} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}>
      <i className={config.icon}></i>
      {config.label}
    </span>
  );
}

export function getPriorityLabel(priority: string): string {
  return priorityConfig[priority]?.label || priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function getSuggestedPriority(category: string): string {
  const map: Record<string, string> = {
    job_dispute: 'urgent',
    payment_issue: 'high',
    late_payment: 'high',
    client_no_show: 'high',
    technical_issue: 'normal',
    account_billing: 'normal',
    general_support: 'low',
  };
  return map[category] || 'normal';
}