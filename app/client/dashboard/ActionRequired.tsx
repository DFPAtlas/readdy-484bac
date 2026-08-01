import Link from 'next/link';
import LoadingSkeleton from '@/app/client/components/LoadingSkeleton';

interface ActionItem {
  label: string;
  count: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  href: string;
  urgent: boolean;
}

interface ActionRequiredProps {
  guardsAwaitingReview: number;
  jobsAwaitingPayment: number;
  jobsStartingSoon: number;
  unreadMessages: number;
  expiringLicences: number;
  openTickets?: number;
  urgentTickets?: number;
  awaitingReplyTickets?: number;
  pendingGuardConfirmations?: number;
  failedPayments?: number;
  guardsNotCheckedIn?: number;
  lateGuards?: number;
  noShows?: number;
  jobsNeedingReplacement?: number;
  emergencyReplacements?: number;
  replacementRequestsOpen?: number;
  replacementAwaitingApproval?: number;
  replacementUnableToFill?: number;
  cancellationRequestsOpen?: number;
  refundRequestsPending?: number;
  jobsUnderAdminReview?: number;
  cancelledJobsThisMonth?: number;
  loading?: boolean;
}

export default function ActionRequired({
  guardsAwaitingReview,
  jobsAwaitingPayment,
  jobsStartingSoon,
  unreadMessages,
  expiringLicences,
  openTickets = 0,
  urgentTickets = 0,
  awaitingReplyTickets = 0,
  pendingGuardConfirmations = 0,
  failedPayments = 0,
  guardsNotCheckedIn = 0,
  lateGuards = 0,
  noShows = 0,
  jobsNeedingReplacement = 0,
  emergencyReplacements = 0,
  replacementRequestsOpen = 0,
  replacementAwaitingApproval = 0,
  replacementUnableToFill = 0,
  cancellationRequestsOpen = 0,
  refundRequestsPending = 0,
  jobsUnderAdminReview = 0,
  cancelledJobsThisMonth = 0,
  loading = false,
}: ActionRequiredProps) {
  const items: ActionItem[] = [
    {
      label: 'Reviews Pending',
      count: guardsAwaitingReview,
      icon: 'ri-star-line',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-500',
      href: '/client/reviews',
      urgent: guardsAwaitingReview > 0,
    },
    {
      label: 'Jobs Awaiting Payment',
      count: jobsAwaitingPayment,
      icon: 'ri-bank-card-line',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-500',
      href: '/client/payment-history',
      urgent: jobsAwaitingPayment > 0,
    },
    {
      label: 'Jobs Starting Soon',
      count: jobsStartingSoon,
      icon: 'ri-calendar-event-line',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-500',
      href: '/client/jobs/tracker',
      urgent: jobsStartingSoon > 0,
    },
    {
      label: 'Unread Messages',
      count: unreadMessages,
      icon: 'ri-message-3-line',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-500',
      href: '/client/messages',
      urgent: unreadMessages > 0,
    },
    {
      label: 'Expiring SIA Licences',
      count: expiringLicences,
      icon: 'ri-shield-flash-line',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      href: '/client/jobs',
      urgent: expiringLicences > 0,
    },
    {
      label: 'Support Tickets',
      count: openTickets,
      icon: 'ri-customer-service-2-line',
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-500',
      href: '/client/support',
      urgent: urgentTickets > 0 || awaitingReplyTickets > 0,
    },
    {
      label: 'Pending Confirmations',
      count: pendingGuardConfirmations,
      icon: 'ri-shield-check-line',
      iconBg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-500',
      href: '/client/jobs/tracker',
      urgent: pendingGuardConfirmations > 0,
    },
    {
      label: 'Failed Payments',
      count: failedPayments,
      icon: 'ri-error-warning-line',
      iconBg: 'bg-rose-500/15',
      iconColor: 'text-rose-500',
      href: '/client/payment-history',
      urgent: failedPayments > 0,
    },
    {
      label: 'Guards Not Checked In',
      count: guardsNotCheckedIn,
      icon: 'ri-login-circle-line',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-500',
      href: '/client/jobs/tracker',
      urgent: guardsNotCheckedIn > 0,
    },
    {
      label: 'Late Guards',
      count: lateGuards,
      icon: 'ri-time-line',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-500',
      href: '/client/jobs/tracker',
      urgent: lateGuards > 0,
    },
    {
      label: 'No-Shows',
      count: noShows,
      icon: 'ri-user-unfollow-line',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      href: '/client/support',
      urgent: noShows > 0,
    },
    {
      label: 'Need Replacements',
      count: jobsNeedingReplacement,
      icon: 'ri-refresh-line',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-500',
      href: '/client/jobs/tracker',
      urgent: jobsNeedingReplacement > 0,
    },
    {
      label: 'Emergency Cover',
      count: emergencyReplacements,
      icon: 'ri-alarm-warning-line',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      href: '/client/jobs/tracker',
      urgent: emergencyReplacements > 0,
    },
    {
      label: 'Replacements Open',
      count: replacementRequestsOpen,
      icon: 'ri-search-line',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-500',
      href: '/client/jobs/tracker',
      urgent: replacementRequestsOpen > 0,
    },
    {
      label: 'Awaiting Approval',
      count: replacementAwaitingApproval,
      icon: 'ri-hourglass-line',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-500',
      href: '/client/jobs/tracker',
      urgent: replacementAwaitingApproval > 0,
    },
    {
      label: 'Unable to Fill',
      count: replacementUnableToFill,
      icon: 'ri-close-circle-line',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      href: '/client/support',
      urgent: replacementUnableToFill > 0,
    },
    {
      label: 'Cancellation Requests',
      count: cancellationRequestsOpen,
      icon: 'ri-close-circle-line',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      href: '/client/jobs',
      urgent: cancellationRequestsOpen > 0,
    },
    {
      label: 'Refund Requests',
      count: refundRequestsPending,
      icon: 'ri-refund-line',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-500',
      href: '/client/jobs',
      urgent: refundRequestsPending > 0,
    },
    {
      label: 'Under Admin Review',
      count: jobsUnderAdminReview,
      icon: 'ri-shield-user-line',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-500',
      href: '/client/support',
      urgent: jobsUnderAdminReview > 0,
    },
    {
      label: 'Cancelled This Month',
      count: cancelledJobsThisMonth,
      icon: 'ri-calendar-close-line',
      iconBg: 'bg-slate-500/15',
      iconColor: 'text-slate-500',
      href: '/client/jobs',
      urgent: false,
    },
  ];

  const totalActions = items.reduce((sum, i) => sum + i.count, 0);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6">
        <div className="h-5 bg-slate-200 dark:bg-[#1e2d4d] rounded w-40 mb-4 animate-pulse" />
        <LoadingSkeleton type="cards" rows={8} columns={4} />
      </div>
    );
  }

  if (totalActions === 0) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-check-double-line text-emerald-500 text-lg" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">All Caught Up</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">No actions requiring your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Action Required</h2>
        <span className="bg-red-500/15 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/25">
          {totalActions}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`group relative bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${
              item.urgent ? 'ring-1 ring-red-500/20' : ''
            }`}
          >
            {item.urgent && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
            <div className={`w-10 h-10 ${item.iconBg} rounded-xl flex items-center justify-center mb-3`}>
              <i className={`${item.icon} text-xl ${item.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{item.count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}