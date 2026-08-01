'use client';

import Link from 'next/link';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet' | 'orange';

interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  size?: 'xs' | 'sm';
}

const JOB_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  open: { label: 'Posted', variant: 'info' },
  pending: { label: 'Pending', variant: 'warning' },
  awaiting_guard_selection: { label: 'Applications Open', variant: 'violet' },
  awaiting_payment: { label: 'Awaiting Payment', variant: 'warning' },
  awaiting_client_confirmation: { label: 'Confirm Booking', variant: 'violet' },
  in_progress: { label: 'Active', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'neutral' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  disputed: { label: 'Disputed', variant: 'orange' },
  payment_pending: { label: 'Payment Pending', variant: 'warning' },
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  danger: 'bg-red-500/10 text-red-400 border-red-500/25',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
};

export function JobStatusBadge({ status, size = 'xs' }: StatusBadgeProps) {
  const config = JOB_STATUS_MAP[status] || { label: status, variant: 'neutral' as BadgeVariant };
  const classes = VARIANT_CLASSES[config.variant];
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border whitespace-nowrap ${classes} ${sizeClass}`}>
      {config.label}
    </span>
  );
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant; icon: string }> = {
  succeeded: { label: 'Paid', variant: 'success', icon: 'ri-checkbox-circle-line' },
  completed: { label: 'Paid', variant: 'success', icon: 'ri-checkbox-circle-line' },
  paid: { label: 'Paid', variant: 'success', icon: 'ri-checkbox-circle-line' },
  pending: { label: 'Pending', variant: 'warning', icon: 'ri-time-line' },
  pending_payment: { label: 'Payment Due', variant: 'warning', icon: 'ri-time-line' },
  processing: { label: 'Processing', variant: 'info', icon: 'ri-loader-4-line' },
  failed: { label: 'Failed', variant: 'danger', icon: 'ri-error-warning-line' },
  refunded: { label: 'Refunded', variant: 'violet', icon: 'ri-refund-line' },
  disputed: { label: 'Disputed', variant: 'orange', icon: 'ri-shield-flash-line' },
  invoice_sent: { label: 'Invoice Sent', variant: 'info', icon: 'ri-mail-send-line' },
  none: { label: 'No Payment', variant: 'neutral', icon: 'ri-money-pound-circle-line' },
};

export function PaymentStatusBadge({ status, size = 'xs' }: StatusBadgeProps) {
  const config = PAYMENT_STATUS_MAP[status] || { label: status, variant: 'neutral' as BadgeVariant, icon: 'ri-question-line' };
  const classes = VARIANT_CLASSES[config.variant];
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border whitespace-nowrap ${classes} ${sizeClass}`}>
      <i className={config.icon}></i>
      {config.label}
    </span>
  );
}

const COMPLIANCE_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant; icon: string }> = {
  compliant: { label: 'Compliant', variant: 'success', icon: 'ri-shield-check-line' },
  expiring_soon: { label: 'Expiring Soon', variant: 'warning', icon: 'ri-timer-flash-line' },
  expired: { label: 'Expired', variant: 'danger', icon: 'ri-shield-cross-line' },
  unverified: { label: 'Unverified', variant: 'neutral', icon: 'ri-shield-line' },
  warning: { label: 'Warning', variant: 'orange', icon: 'ri-error-warning-line' },
};

export function ComplianceBadge({ status, size = 'xs' }: StatusBadgeProps) {
  const config = COMPLIANCE_STATUS_MAP[status] || { label: status, variant: 'neutral' as BadgeVariant, icon: 'ri-shield-line' };
  const classes = VARIANT_CLASSES[config.variant];
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border whitespace-nowrap ${classes} ${sizeClass}`}>
      <i className={config.icon}></i>
      {config.label}
    </span>
  );
}

export function TicketStatusBadge({ status, size = 'xs' }: StatusBadgeProps) {
  const TICKET_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
    open: { label: 'Open', variant: 'danger' },
    awaiting_client: { label: 'Awaiting Reply', variant: 'warning' },
    under_review: { label: 'Under Review', variant: 'violet' },
    escalated: { label: 'Escalated', variant: 'orange' },
    resolved: { label: 'Resolved', variant: 'success' },
    closed: { label: 'Closed', variant: 'neutral' },
  };
  const config = TICKET_MAP[status] || { label: status, variant: 'neutral' as BadgeVariant };
  const classes = VARIANT_CLASSES[config.variant];
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold border whitespace-nowrap ${classes} ${sizeClass}`}>
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority, size = 'xs' }: { priority: string; size?: 'xs' | 'sm' }) {
  const PRIORITY_MAP: Record<string, { label: string; variant: BadgeVariant; icon: string }> = {
    urgent: { label: 'Urgent', variant: 'danger', icon: 'ri-alarm-warning-line' },
    high: { label: 'High', variant: 'orange', icon: 'ri-arrow-up-line' },
    normal: { label: 'Normal', variant: 'info', icon: 'ri-subtract-line' },
    low: { label: 'Low', variant: 'neutral', icon: 'ri-arrow-down-line' },
  };
  const config = PRIORITY_MAP[priority] || { label: priority, variant: 'neutral' as BadgeVariant, icon: 'ri-flag-line' };
  const classes = VARIANT_CLASSES[config.variant];
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border whitespace-nowrap ${classes} ${sizeClass}`}>
      <i className={config.icon}></i>
      {config.label}
    </span>
  );
}