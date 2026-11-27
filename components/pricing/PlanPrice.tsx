import { pricingMoney, subscriptionPrice, type PublicPricingPlan } from '@/lib/public-pricing';

export default function PlanPrice({ plan, print = false, billingCycle = 'monthly' }: {
  plan: Pick<PublicPricingPlan, 'monthly_price_pence'> & Partial<Pick<PublicPricingPlan, 'stripe_annual_price_id'>>;
  print?: boolean;
  billingCycle?: 'monthly' | 'annual';
}) {
  const price = subscriptionPrice({ monthly_price_pence: plan.monthly_price_pence, stripe_annual_price_id: plan.stripe_annual_price_id ?? null }, billingCycle);
  if (!price) {
    return (
      <p role="status" className={print ? 'text-sm text-amber-800' : 'text-sm text-amber-300'}>
        {billingCycle === 'annual' ? 'Annual billing unavailable' : 'Current price unavailable. Please refresh.'}
      </p>
    );
  }
  const annual = billingCycle === 'annual' && price.billedPence > 0;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-3xl font-bold ${print ? 'text-slate-900' : 'text-white'}`}>{pricingMoney(price.monthlyEquivalentPence)}</span>
        <span className={print ? 'text-sm text-slate-500' : 'text-slate-400'}>{annual ? '/month equivalent' : '/month'}</span>
      </div>
      {annual && <p className={print ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>Billed annually: {pricingMoney(price.billedPence)} per year.</p>}
      {price.billedPence === 0 && (
        <p className={`text-xs mt-1 ${print ? 'text-slate-600' : 'text-slate-400'}`}>
          No subscription charge. No credit card required.
        </p>
      )}
    </div>
  );
}
