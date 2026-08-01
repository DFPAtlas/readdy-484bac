import Link from 'next/link';

interface ClientPlanData {
  client_service_tier: string;
  service_tier_started_at: string;
  total_jobs_posted: number;
  total_spent: number;
  created_at: string;
  client_promo_tier?: string;
  client_promo_ends_at?: string | null;
  client_lifetime_fee_discount?: number | null;
  client_signup_number?: number | null;
  founding_client_badge?: boolean;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function YourPlanCard({ client }: { client: ClientPlanData }) {
  const tier = client.client_service_tier || 'payg';
  const memberSince = new Date(client.service_tier_started_at || client.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const tierConfig: Record<string, { label: string; tagline: string; badgeColor: string; badgeBg: string; badgeBorder: string }> = {
    payg: {
      label: 'Pay-As-You-Go',
      tagline: 'Pay per shift, no commitment',
      badgeColor: 'text-teal-400',
      badgeBg: 'bg-teal-500/10',
      badgeBorder: 'border-teal-400/20',
    },
    regular_sub: {
      label: 'Regular Subscription',
      tagline: 'Monthly plan, lower fees',
      badgeColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/10',
      badgeBorder: 'border-blue-400/20',
    },
    pro_sub: {
      label: 'Pro Subscription',
      tagline: 'Multi-site, high volume',
      badgeColor: 'text-purple-400',
      badgeBg: 'bg-purple-500/10',
      badgeBorder: 'border-purple-400/20',
    },
  };

  const config = tierConfig[tier] || tierConfig.payg;

  const promoTier = client.client_promo_tier;
  const promoEnds = client.client_promo_ends_at ? new Date(client.client_promo_ends_at) : null;
  const promoDaysLeft = promoEnds ? daysBetween(new Date(), promoEnds) : null;

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your Plan</h2>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${config.badgeBg} ${config.badgeColor} ${config.badgeBorder}`}>
          {config.label}
        </span>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{config.tagline}</p>

      {promoTier && promoTier !== 'standard' && (
        <div className={`mb-4 rounded-xl p-3 border text-sm ${
          promoTier === 'founding_client' ? 'bg-amber-500/10 border-amber-400/20' :
          promoTier === 'early_client' ? 'bg-slate-500/10 border-slate-400/20' :
          'bg-teal-500/10 border-teal-400/20'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <i className={`${
              promoTier === 'founding_client' ? 'ri-vip-crown-2-line text-amber-400' :
              promoTier === 'early_client' ? 'ri-star-line text-slate-300' :
              'ri-rocket-line text-teal-400'
            }`} />
            <span className={`font-semibold ${
              promoTier === 'founding_client' ? 'text-amber-400' :
              promoTier === 'early_client' ? 'text-slate-300' :
              'text-teal-400'
            }`}>
              {promoTier === 'founding_client' ? 'Founding Client' :
               promoTier === 'early_client' ? 'Early Client' : 'Launch Client'}
              {client.client_signup_number ? ` #${String(client.client_signup_number).padStart(3, '0')}` : ''}
            </span>
          </div>
          {promoDaysLeft !== null && promoDaysLeft > 0 && (
            <p className="text-slate-400 text-xs">
              {promoDaysLeft}d remaining on zero fees
            </p>
          )}
          {promoTier === 'founding_client' && client.client_lifetime_fee_discount && (
            <p className="text-slate-400 text-xs">
              Lifetime {Math.round(client.client_lifetime_fee_discount * 100)}% off after
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">Jobs posted</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{client.total_jobs_posted || 0}</p>
        </div>
        <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">Total spend</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(client.total_spent || 0)}
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {[
          { icon: 'ri-calendar-line', label: 'Member since', value: memberSince },
          { icon: 'ri-shield-check-line', label: 'Service fee', value: tier === 'payg' ? '15% per booking' : tier === 'regular_sub' ? '8% per booking' : '4% per booking' },
        ].map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 dark:bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${row.icon} text-slate-500 text-sm`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">{row.label}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade link */}
      <Link
        href="/pricing"
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all whitespace-nowrap border border-teal-400/20 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 cursor-pointer"
      >
        <i className="ri-arrow-up-circle-line" />
        Save more with a subscription
      </Link>
    </div>
  );
}