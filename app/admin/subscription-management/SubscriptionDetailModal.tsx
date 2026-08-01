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
  updated_at: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  last_payment_date: string | null;
  payment_status: string | null;
  payment_failure_count: number;
  last_payment_error: string | null;
  billing_cycle: string | null;
  amount_paid: number | null;
  trial_end_date: string | null;
  currency: string | null;
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
  subscription: Subscription;
  user: UserInfo | null;
  plan: Plan | null;
  onClose: () => void;
  onCancel: () => void;
  onResume: () => void;
  actionLoading: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCurrencySymbol(currency: string | null): string {
  switch ((currency || '').toLowerCase()) {
    case 'usd': return '$';
    case 'eur': return '\u20AC';
    case 'gbp': return '\u00A3';
    default: return '\u00A3';
  }
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return '\u2014';
  const sym = getCurrencySymbol(currency);
  const val = Number(amount);
  return `${sym}${val.toFixed(2)}`;
}

export default function SubscriptionDetailModal({ subscription, user, plan, onClose, onCancel, onResume, actionLoading }: Props) {
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isCancelled = subscription.cancel_at_period_end || subscription.status === 'cancelled' || subscription.status === 'canceled';
  const hasStripe = !!subscription.stripe_subscription_id;
  const hasStripeCustomer = !!subscription.stripe_customer_id;
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  const gradient = isCancelled
    ? 'from-slate-600 to-slate-700'
    : isActive
    ? 'from-teal-600 to-emerald-700'
    : 'from-red-600 to-rose-700';

  const statusLabel = isCancelled
    ? 'Cancelling at period end'
    : subscription.status === 'active'
    ? 'Active'
    : subscription.status === 'trialing'
    ? 'Trial'
    : subscription.status === 'past_due'
    ? 'Past Due'
    : subscription.status === 'pending'
    ? 'Pending'
    : subscription.status;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`bg-gradient-to-br ${gradient} p-6 text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Subscription Detail</p>
                <h3 className="text-2xl font-bold">{subscription.plan_name}</h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 whitespace-nowrap">
                {statusLabel}
              </span>
            </div>

            {user && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <i className="ri-user-line text-sm text-white"></i>
                </div>
                <div>
                  <p className="text-sm font-medium">{user.full_name || 'Unknown'}</p>
                  <p className="text-xs text-white/60">{user.email} \u2022 {user.user_type}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-white"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0a1628] rounded-xl p-3 border border-[#1e2d4a]">
              <p className="text-xs text-slate-500 mb-1">Days Left</p>
              <p className={`text-lg font-bold ${daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-white'}`}>
                {daysLeft}
              </p>
            </div>
            <div className="bg-[#0a1628] rounded-xl p-3 border border-[#1e2d4a]">
              <p className="text-xs text-slate-500 mb-1">Amount Paid</p>
              <p className="text-lg font-bold text-white">
                {formatAmount(subscription.amount_paid, subscription.currency)}
              </p>
            </div>
            <div className="bg-[#0a1628] rounded-xl p-3 border border-[#1e2d4a]">
              <p className="text-xs text-slate-500 mb-1">Billing</p>
              <p className="text-lg font-bold text-white capitalize">
                {subscription.billing_cycle || 'Monthly'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Timeline</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Created</span>
                <span className="font-medium text-slate-200">{formatDateTime(subscription.created_at)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Period Start</span>
                <span className="font-medium text-slate-200">{formatDate(subscription.current_period_start)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Period End</span>
                <span className="font-medium text-slate-200">{formatDate(subscription.current_period_end)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Last Payment</span>
                <span className="font-medium text-slate-200">{formatDate(subscription.last_payment_date)}</span>
              </div>
              {subscription.trial_end_date && (
                <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                  <span className="text-slate-400">Trial Ends</span>
                  <span className="font-medium text-slate-200">{formatDate(subscription.trial_end_date)}</span>
                </div>
              )}
              {subscription.cancelled_at && (
                <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                  <span className="text-slate-400">Cancelled At</span>
                  <span className="font-medium text-red-400">{formatDate(subscription.cancelled_at)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Stripe Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Subscription ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-300 bg-[#0a1628] px-2 py-1 rounded truncate max-w-[160px]">
                    {subscription.stripe_subscription_id || '\u2014'}
                  </span>
                  {hasStripe && (
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 flex items-center justify-center text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0"
                      title="Open in Stripe"
                    >
                      <i className="ri-external-link-line text-xs"></i>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Customer ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-300 bg-[#0a1628] px-2 py-1 rounded truncate max-w-[160px]">
                    {subscription.stripe_customer_id || '\u2014'}
                  </span>
                  {hasStripeCustomer && (
                    <a
                      href={`https://dashboard.stripe.com/customers/${subscription.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 flex items-center justify-center text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0"
                      title="Open Customer in Stripe"
                    >
                      <i className="ri-external-link-line text-xs"></i>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                <span className="text-slate-400">Payment Status</span>
                <span className="font-medium text-slate-200 capitalize">{subscription.payment_status || '\u2014'}</span>
              </div>
              {subscription.last_payment_error && (
                <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                  <span className="text-slate-400">Last Error</span>
                  <span className="font-medium text-red-400 text-xs max-w-[200px] truncate">{subscription.last_payment_error}</span>
                </div>
              )}
              {subscription.payment_failure_count > 0 && (
                <div className="flex justify-between py-2 border-b border-[#1e2d4a]/50">
                  <span className="text-slate-400">Failed Payments</span>
                  <span className="font-medium text-red-400">{subscription.payment_failure_count}</span>
                </div>
              )}
            </div>
          </div>

          {plan && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Plan</h4>
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-200">{plan.name}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20 capitalize">
                    {plan.audience}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {(plan.monthly_price_pence / 100).toFixed(2)} {getCurrencySymbol(subscription.currency)}/month
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-[#1e2d4a] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Close
            </button>
            {hasStripe && isActive && !isCancelled && (
              <button
                onClick={onCancel}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? 'Processing...' : 'Cancel Subscription'}
              </button>
            )}
            {hasStripe && isCancelled && (
              <button
                onClick={onResume}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? 'Processing...' : 'Resume Subscription'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}