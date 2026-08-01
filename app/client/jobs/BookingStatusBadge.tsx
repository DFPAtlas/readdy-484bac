interface BookingStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  draft: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', icon: 'ri-draft-line', label: 'Draft' },
  pending: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', icon: 'ri-time-line', label: 'Pending' },
  open: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', icon: 'ri-send-plane-line', label: 'Awaiting Applicants' },
  awaiting_guard_selection: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', icon: 'ri-user-search-line', label: 'Awaiting Guard Selection' },
  awaiting_payment: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-secure-payment-line', label: 'Awaiting Payment' },
  awaiting_client_confirmation: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', icon: 'ri-file-shield-line', label: 'Awaiting Client Confirmation' },
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', icon: 'ri-checkbox-circle-line', label: 'Confirmed' },
  in_progress: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/25', icon: 'ri-pulse-line', label: 'Active' },
  active: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/25', icon: 'ri-pulse-line', label: 'Active' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', icon: 'ri-trophy-line', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', icon: 'ri-close-circle-line', label: 'Cancelled' },
  disputed: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-shield-flash-line', label: 'Disputed' },
};

export default function BookingStatusBadge({ status, size = 'md' }: BookingStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };
  const iconSize = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' };

  return (
    <span className={`${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} rounded-full font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap`}>
      <i className={`${config.icon} ${iconSize[size]}`}></i>
      {config.label}
    </span>
  );
}