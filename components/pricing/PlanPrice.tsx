import { pricingMoney, type PublicPricingPlan } from '@/lib/public-pricing';

export default function PlanPrice({ plan, print = false }: {
  plan: Pick<PublicPricingPlan, 'monthly_price_pence'>;
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
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-3xl font-bold ${print ? 'text-slate-900' : 'text-white'}`}>{pricingMoney(pence)}</span>
        <span className={print ? 'text-sm text-slate-500' : 'text-slate-400'}>/month</span>
      </div>
      {pence === 0 && (
        <p className={`text-xs mt-1 ${print ? 'text-slate-600' : 'text-slate-400'}`}>
          No subscription charge. No credit card required.
        </p>
      )}
    </div>
  );
}