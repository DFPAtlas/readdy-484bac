import { pricingMoney, subscriptionPrice, type PublicPricingPlan } from '@/lib/public-pricing';

export default function PlanPrice({ plan, billingCycle, print = false }: {
  plan: Pick<PublicPricingPlan, 'monthly_price_pence' | 'stripe_annual_price_id'>;
  billingCycle: 'monthly' | 'annual';
  print?: boolean;
}) {
  const price = subscriptionPrice(plan, billingCycle);
  if (!price) return <p role="status" className={print ? 'text-sm text-amber-800' : 'text-sm text-amber-300'}>Annual billing unavailable. Choose monthly billing.</p>;
  const annual = billingCycle === 'annual' && plan.monthly_price_pence > 0;
  return <div>
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`text-3xl font-bold ${print ? 'text-slate-900' : 'text-white'}`}>{pricingMoney(price.monthlyEquivalentPence)}</span>
      <span className={print ? 'text-sm text-slate-500' : 'text-slate-400'}>{annual ? '/month equivalent' : '/month'}</span>
    </div>
    {annual && <>
      {price.savingPercent > 0 && <p className={`text-sm font-semibold mt-1 ${print ? 'text-teal-700' : 'text-emerald-400'}`}>Save {price.savingPercent}% with annual billing</p>}
      <p className={`text-xs mt-1 ${print ? 'text-slate-600' : 'text-slate-400'}`}>Billed {pricingMoney(price.billedPence)} upfront each year</p>
    </>}
    {plan.monthly_price_pence === 0 && <p className="text-xs text-slate-500 mt-1">No subscription charge. No credit card required.</p>}
  </div>;
}
