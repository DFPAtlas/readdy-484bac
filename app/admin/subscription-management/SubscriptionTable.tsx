'use client';

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  plan_slug: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  current_period_end: string;
  current_period_start: string;
  created_at: string;
  cancel_at_period_end: boolean;
  last_payment_date: string | null;
  payment_status: string | null;
  payment_failure_count: number;
  last_payment_error: string | null;
  billing_cycle: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

interface Plan {
  slug: string;
  name: string;
  audience: string;
  monthly_price_pence: number;
}

interface Props {
  subscriptions: Subscription[];
  users: Record<string, UserInfo> | undefined;
  plans: Plan[];
  sortBy: 'period_end' | 'created' | 'status';
  sortDir: 'asc' | 'desc';
  onToggleSort: (field: 'period_end' | 'created' | 'status') => void;
  onViewDetail: (sub: Subscription) => void;
  loading: boolean;
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadge(status: string, cancelAtEnd: boolean) {
  let cls = 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  let label = status;
  let icon: string | null = null;

  if (status === 'active' || status === 'trialing') {
    cls = cancelAtEnd ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    label = cancelAtEnd ? 'Cancelling' : 'Active';
    icon = cancelAtEnd ? 'ri-time-line' : 'ri-checkbox-circle-line';
  } else if (status === 'pending') {
    cls = 'bg-sky-500/15 text-sky-400 border-sky-500/20';
  } else if (status === 'past_due') {
    cls = 'bg-red-500/15 text-red-400 border-red-500/20';
    label = 'Past Due';
    icon = 'ri-error-warning-line';
  } else if (status === 'cancelled' || status === 'canceled') {
    cls = 'bg-slate-500/15 text-slate-500 border-slate-500/20';
    label = 'Cancelled';
    icon = 'ri-close-circle-line';
  } else if (status === 'incomplete') {
    cls = 'bg-orange-500/15 text-orange-400 border-orange-500/20';
    label = 'Incomplete';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls} whitespace-nowrap`}>
      {icon && <i className={`${icon} text-xs`}></i>}
      {label}
    </span>
  );
}

export default function SubscriptionTable({
  subscriptions,
  users,
  sortBy,
  sortDir,
  onToggleSort,
  onViewDetail,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm">Loading subscriptions...</p>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <i className="ri-inbox-line text-5xl text-slate-600"></i>
        </div>
        <p className="text-slate-500 text-sm">No subscriptions found matching your filters.</p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: 'period_end' | 'created' | 'status' }) => {
    if (sortBy !== field) return <i className="ri-arrow-up-down-line text-xs text-slate-600 ml-1"></i>;
    return sortDir === 'asc'
      ? <i className="ri-arrow-up-line text-xs text-teal-400 ml-1"></i>
      : <i className="ri-arrow-down-line text-xs text-teal-400 ml-1"></i>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#1e2d4a] bg-[#0d1b33]">
            <th className="px-5 py-3 font-semibold text-slate-400">User</th>
            <th className="px-5 py-3 font-semibold text-slate-400">Plan</th>
            <th className="px-5 py-3 font-semibold text-slate-400 cursor-pointer whitespace-nowrap" onClick={() => onToggleSort('status')}>
              Status <SortIcon field="status" />
            </th>
            <th className="px-5 py-3 font-semibold text-slate-400 cursor-pointer whitespace-nowrap" onClick={() => onToggleSort('period_end')}>
              Period Ends <SortIcon field="period_end" />
            </th>
            <th className="px-5 py-3 font-semibold text-slate-400">Days Left</th>
            <th className="px-5 py-3 font-semibold text-slate-400">Stripe</th>
            <th className="px-5 py-3 font-semibold text-slate-400 cursor-pointer whitespace-nowrap" onClick={() => onToggleSort('created')}>
              Created <SortIcon field="created" />
            </th>
            <th className="px-5 py-3 font-semibold text-slate-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2d4a]/50">
          {subscriptions.map((sub) => {
            const user = users?.[sub.user_id];
            const dLeft = daysUntil(sub.current_period_end);
            const hasStripe = !!sub.stripe_subscription_id;

            return (
              <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-500/15 flex items-center justify-center flex-shrink-0">
                      <i className="ri-user-line text-teal-400 text-xs"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200 truncate">
                        {user?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user?.email || sub.user_id.slice(0, 8)}</p>
                      {user?.user_type && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                          user.user_type === 'client' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {user.user_type}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-200">{sub.plan_name}</p>
                  <p className="text-xs text-slate-500">{sub.plan_slug || '\u2014'}</p>
                </td>
                <td className="px-5 py-4">
                  {statusBadge(sub.status, sub.cancel_at_period_end)}
                  {sub.payment_failure_count > 0 && (
                    <p className="text-[10px] text-red-400 mt-1">
                      {sub.payment_failure_count} failed payment(s)
                    </p>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-300 whitespace-nowrap">
                  {formatDate(sub.current_period_end)}
                </td>
                <td className="px-5 py-4">
                  <span className={`text-sm font-semibold ${
                    dLeft <= 3 ? 'text-red-400' : dLeft <= 7 ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    {dLeft}d
                  </span>
                </td>
                <td className="px-5 py-4">
                  {hasStripe ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-400 hover:text-teal-300 font-mono truncate max-w-[120px] transition-colors"
                        title={sub.stripe_subscription_id || undefined}
                      >
                        {sub.stripe_subscription_id?.slice(0, 14)}...
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0"></span>
                      <span className="text-xs text-slate-500">No Stripe ID</span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                  {formatDate(sub.created_at)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onViewDetail(sub)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-eye-line"></i>
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}