import Link from 'next/link';

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end_date: string | null;
  billing_cycle: string | null;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function SubscriptionCard({ sub }: { sub: SubscriptionInfo }) {
  const daysLeft = getDaysUntil(sub.current_period_end);
  const expiryDate = new Date(sub.current_period_end).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const isExpired = daysLeft <= 0;
  const isCritical = daysLeft > 0 && daysLeft <= 3;
  const isWarning = daysLeft > 3 && daysLeft <= 7;
  const isTrial = sub.status === 'trialing' || (!!sub.trial_end_date && new Date(sub.trial_end_date) > new Date());

  let gradient = 'from-blue-600 to-indigo-700';
  let statusLabel = 'Active';
  let statusBg = 'bg-white/20';

  if (isExpired) { gradient = 'from-red-500 to-rose-700'; statusLabel = 'Expired'; }
  else if (isCritical) { gradient = 'from-red-400 to-orange-600'; statusLabel = 'Expiring Soon'; }
  else if (isWarning) { gradient = 'from-amber-500 to-orange-600'; statusLabel = 'Renewing Soon'; }
  else if (isTrial) { gradient = 'from-violet-500 to-purple-700'; statusLabel = 'Trial'; }

  const message = isExpired
    ? `Expired on ${expiryDate}`
    : isCritical
    ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
    : isWarning
    ? `Renews in ${daysLeft} days — ${expiryDate}`
    : `Active until ${expiryDate}`;

  const progress = isExpired ? 0 : Math.min(100, Math.round((daysLeft / 30) * 100));

  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Subscription</p>
            <h3 className="text-2xl font-bold">{sub.plan_name} Plan</h3>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBg} backdrop-blur-sm border border-white/20`}>
            {statusLabel}
          </span>
        </div>

        <p className="text-white/80 text-sm mb-4">{message}</p>

        {!isExpired && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>Period progress</span>
              <span>{daysLeft} days left</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {sub.billing_cycle && (
            <p className="text-white/60 text-xs capitalize">
              Billed {sub.billing_cycle} · Auto-renew {!sub.cancel_at_period_end ? 'on' : 'off'}
            </p>
          )}
          {(isExpired || isCritical || isWarning) && (
            <Link
              href="/pricing"
              className="ml-auto bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isExpired ? 'Renew Now' : 'Manage Plan'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
