'use client';

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
}

const config: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  job_update: { label: 'Job Update', icon: 'ri-briefcase-line', bg: 'bg-blue-500/15', color: 'text-blue-400' },
  new_applicants: { label: 'New Applicants', icon: 'ri-user-add-line', bg: 'bg-violet-500/15', color: 'text-violet-400' },
  guard_selection: { label: 'Guard Selection', icon: 'ri-user-follow-line', bg: 'bg-indigo-500/15', color: 'text-indigo-400' },
  guard_confirmation: { label: 'Guard Confirmation', icon: 'ri-shield-check-line', bg: 'bg-teal-500/15', color: 'text-teal-400' },
  payment_alert: { label: 'Payment Alert', icon: 'ri-wallet-3-line', bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  message: { label: 'Message', icon: 'ri-message-3-line', bg: 'bg-amber-500/15', color: 'text-amber-400' },
  support_ticket: { label: 'Support Ticket', icon: 'ri-customer-service-2-line', bg: 'bg-rose-500/15', color: 'text-rose-400' },
  account_billing: { label: 'Account / Billing', icon: 'ri-vip-crown-line', bg: 'bg-slate-500/15', color: 'text-slate-400' },
  general: { label: 'General', icon: 'ri-notification-3-line', bg: 'bg-slate-500/15', color: 'text-slate-400' },
  payment: { label: 'Payment', icon: 'ri-wallet-3-line', bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  guard_assigned: { label: 'Guard Assigned', icon: 'ri-shield-user-line', bg: 'bg-purple-500/15', color: 'text-purple-400' },
  complaint: { label: 'Complaint', icon: 'ri-feedback-line', bg: 'bg-red-500/15', color: 'text-red-400' },
  subscription: { label: 'Subscription', icon: 'ri-vip-crown-line', bg: 'bg-amber-500/15', color: 'text-amber-400' },
  replacement_request: { label: 'Replacement', icon: 'ri-refresh-line', bg: 'bg-violet-500/15', color: 'text-violet-400' },
};

export default function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const c = config[category] || config.general;
  const base = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium border border-white/10 ${c.bg} ${c.color} ${base}`}>
      <i className={c.icon}></i>
      {c.label}
    </span>
  );
}