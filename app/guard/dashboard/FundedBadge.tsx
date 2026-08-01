'use client';

interface FundedBadgeProps {
  paymentStatus?: string | null;
  size?: 'sm' | 'md';
}

export default function FundedBadge({ paymentStatus, size = 'sm' }: FundedBadgeProps) {
  if (!paymentStatus) return null;

  const configs: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    funded: {
      label: 'Funded',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/25',
      icon: 'ri-shield-check-line',
    },
    payment_pending: {
      label: 'Awaiting Payment',
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/25',
      icon: 'ri-time-line',
    },
    unpaid: {
      label: 'Unpaid',
      bg: 'bg-slate-500/15',
      text: 'text-slate-400',
      border: 'border-slate-500/25',
      icon: 'ri-money-pound-circle-line',
    },
    completed: {
      label: 'Paid Out',
      bg: 'bg-teal-500/15',
      text: 'text-teal-400',
      border: 'border-teal-500/25',
      icon: 'ri-checkbox-circle-line',
    },
    disputed: {
      label: 'Disputed',
      bg: 'bg-orange-500/15',
      text: 'text-orange-400',
      border: 'border-orange-500/25',
      icon: 'ri-alert-line',
    },
    released: {
      label: 'Payout Released',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/25',
      icon: 'ri-send-plane-line',
    },
    refunded: {
      label: 'Refunded',
      bg: 'bg-red-500/15',
      text: 'text-red-400',
      border: 'border-red-500/25',
      icon: 'ri-refund-line',
    },
  };

  const config = configs[paymentStatus];
  if (!config) return null;

  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 ${padding} rounded-full font-semibold border ${config.bg} ${config.text} ${config.border} ${textSize}`}>
      <i className={`${config.icon} text-[10px]`}></i>
      {config.label}
    </span>
  );
}