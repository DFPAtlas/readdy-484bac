'use client';

interface CancellationStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  requested: {
    label: 'Cancellation Requested',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    icon: 'ri-time-line',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/25',
    icon: 'ri-close-circle-line',
  },
  refund_pending: {
    label: 'Refund Pending',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/25',
    icon: 'ri-hourglass-line',
  },
  refund_approved: {
    label: 'Refund Approved',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    icon: 'ri-check-double-line',
  },
  refund_rejected: {
    label: 'Refund Rejected',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/25',
    icon: 'ri-forbid-line',
  },
  credit_issued: {
    label: 'Credit Issued',
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/25',
    icon: 'ri-coupon-line',
  },
  under_admin_review: {
    label: 'Under Admin Review',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    icon: 'ri-shield-user-line',
  },
  unable_to_fill: {
    label: 'Unable to Fill',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/25',
    icon: 'ri-error-warning-line',
  },
};

export default function CancellationStatusBadge({ status, size = 'md' }: CancellationStatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig.requested;
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center font-semibold border rounded-full ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}>
      <i className={cfg.icon}></i>
      {cfg.label}
    </span>
  );
}