'use client';

interface AttentionItem {
  type: string;
  label: string;
  icon: string;
  color: 'amber' | 'orange' | 'red' | 'blue';
}

interface NeedsAttentionBadgeProps {
  items: AttentionItem[];
  compact?: boolean;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25' },
};

export default function NeedsAttentionBadge({ items, compact = false }: NeedsAttentionBadgeProps) {
  if (items.length === 0) return null;

  const first = items[0];
  const colors = colorMap[first.color] || colorMap.amber;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border} whitespace-nowrap`}>
        <i className={first.icon}></i>
        {items.length > 1 ? `${items.length} needs attention` : first.label}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const c = colorMap[item.color] || colorMap.amber;
        return (
          <span key={item.type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border} whitespace-nowrap`}>
            <i className={item.icon}></i>
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

export function getAttentionItems(job: any): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = new Date().getTime();
  const startTime = job.start_date ? new Date(job.start_date).getTime() : 0;
  const hoursToStart = startTime ? (startTime - now) / (1000 * 60 * 60) : Infinity;

  if (['open', 'pending', 'awaiting_guard_selection'].includes(job.status) && (job.applications_count || 0) === 0) {
    items.push({ type: 'no_applicants', label: 'No applicants yet', icon: 'ri-user-search-line', color: 'amber' });
  }

  const assigned = job.assigned_count || 0;
  const needed = job.number_of_guards || 1;
  if (assigned < needed && ['awaiting_guard_selection', 'awaiting_payment'].includes(job.status)) {
    items.push({
      type: 'not_enough_guards',
      label: `${needed - assigned} guard${needed - assigned > 1 ? 's' : ''} still needed`,
      icon: 'ri-user-unfollow-line',
      color: 'orange',
    });
  }

  if (job.status === 'awaiting_payment') {
    items.push({ type: 'payment_pending', label: 'Payment pending', icon: 'ri-secure-payment-line', color: 'red' });
  }

  if (hoursToStart > 0 && hoursToStart < 48 && ['awaiting_payment', 'awaiting_guard_selection', 'open'].includes(job.status)) {
    items.push({
      type: 'starting_soon',
      label: hoursToStart < 24 ? 'Starting within 24h' : 'Starting within 48h',
      icon: 'ri-time-line',
      color: 'red',
    });
  }

  if (!job.special_instructions && job.status !== 'completed' && job.status !== 'cancelled') {
    items.push({ type: 'missing_instructions', label: 'Missing site instructions', icon: 'ri-file-warning-line', color: 'amber' });
  }

  return items;
}