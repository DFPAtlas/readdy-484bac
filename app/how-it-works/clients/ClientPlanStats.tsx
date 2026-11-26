import type { PublicPricingPlan } from '@/lib/public-pricing';

export default function ClientPlanStats({
  plans,
  loading,
  error,
  feesError,
}: {
  plans: PublicPricingPlan[];
  loading: boolean;
  error: string | null;
  feesError: boolean;
}) {
  const clientPlans = plans.filter((plan) => plan.audience === 'client');
  const fees = clientPlans
    .map((plan) => plan.bookingFee)
    .filter((fee): fee is number => typeof fee === 'number');
  const limits = clientPlans.map((plan) => plan.job_limit_per_month);
  const numericLimits = limits.filter((limit): limit is number => typeof limit === 'number');
  const hasUnlimited = limits.some((limit) => limit === null);
  const pricingUnavailable = loading || !!error || feesError || clientPlans.length === 0;

  const feeRange = pricingUnavailable || fees.length === 0
    ? 'See pricing page'
    : `${Math.min(...fees)}% to ${Math.max(...fees)}%`;

  const allowanceRange = pricingUnavailable || numericLimits.length === 0
    ? 'See pricing page'
    : hasUnlimited
      ? `${Math.min(...numericLimits)} to Unlimited`
      : `${Math.min(...numericLimits)} to ${Math.max(...numericLimits)}`;

  const stats = [
    { icon: 'ri-percent-line', value: feeRange, label: 'Standard booking service fee, set by plan' },
    { icon: 'ri-file-list-3-line', value: allowanceRange, label: 'Job postings allowed each month' },
    { icon: 'ri-user-add-line', value: 'Free', label: 'Guard registration, browsing and applications' },
    { icon: 'ri-lock-2-line', value: 'Stripe', label: 'Booking payment before the shift is confirmed' },
  ];

  return (
    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[#111d35] border border-slate-700/50 rounded-2xl px-6 py-5 text-center hover:border-teal-500/30 transition-colors duration-300"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl mx-auto mb-3 border border-teal-400/20">
            <i className={`${stat.icon} text-teal-400 text-xl`} />
          </div>
          <p className="text-xl font-bold text-white mb-1">{stat.value}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}