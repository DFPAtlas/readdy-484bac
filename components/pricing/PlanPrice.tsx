import { pricingMoney, subscriptionPrice, type PublicPricingPlan } from '@/lib/public-pricing';

export default function PlanPrice({ plan, billingCycle = 'monthly', print = false }: {
  plan: Pick<PublicPricingPlan, 'monthly_price_pence'> & Partial<Pick<PublicPricingPlan, 'stripe_annual_price_id'>>;
  billingCycle?: 'monthly' | 'annual';
  print?: boolean;
}) {
  const pence = plan.monthly_price_pence;
  if (!Number.isSafeInteger(pence) || pence < 0) {
    return (
      <p role="status" className={print ? 'text-sm text-amber-800' : 'text-sm text-amber-300'}>
        Current price unavailable. Please refresh.
      </p>
    );
  }
  const annual = billingCycle === 'annual' && pence > 0;
  const annualPrice = annual ? subscriptionPrice({
    monthly_price_pence: pence,
    stripe_annual_price_id: plan.stripe_annual_price_id ?? null,
  }, 'annual') : null;
  if (annual && !annualPrice) {
    return <p role="status" className={print ? 'text-sm text-amber-800' : 'text-sm text-amber-300'}>Annual billing unavailable. Choose monthly billing.</p>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-3xl font-bold ${print ? 'text-slate-900' : 'text-white'}`}>{pricingMoney(annualPrice?.monthlyEquivalentPence ?? pence)}</span>
        <span className={print ? 'text-sm text-slate-500' : 'text-slate-400'}>{annual ? '/month equivalent' : '/month'}</span>
      </div>
      {annualPrice && <>
        {annualPrice.savingPercent > 0 && <p className={`text-sm font-semibold mt-1 ${print ? 'text-teal-700' : 'text-emerald-400'}`}>Save {annualPrice.savingPercent}% with annual billing</p>}
        <p className={`text-xs mt-1 ${print ? 'text-slate-600' : 'text-slate-400'}`}>Billed {pricingMoney(annualPrice.billedPence)} upfront each year</p>
      </>}
      {pence === 0 && (
        <p className={`text-xs mt-1 ${print ? 'text-slate-600' : 'text-slate-400'}`}>
          No subscription charge. No credit card required.
        </p>
      )}
    </div>
  );
}
