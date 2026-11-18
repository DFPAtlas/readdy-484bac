import type { SandboxPlan } from './types';

interface Props {
  plans: SandboxPlan[];
  pending: string | null;
  disabled: boolean;
  onSelect: (planId: string) => void;
}

export default function SandboxPlanButtons({ plans, pending, disabled, onSelect }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-1">Start a test checkout</h2>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Each button opens a Stripe test Checkout with a saved card requirement and the agreed 1 January 2027 first charge. No card is really charged.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plans.map((plan) => {
          const busy = pending === plan.slug;
          return (
            <button
              key={plan.slug}
              type="button"
              disabled={disabled || Boolean(pending)}
              onClick={() => onSelect(plan.slug)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition-all hover:border-teal-400 hover:bg-teal-50/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{plan.label}</span>
                <span className="block text-xs text-slate-500">
                  £{(plan.monthlyPricePence / 100).toFixed(0)} per month from 1 Jan 2027
                </span>
              </span>
              <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0">
                {busy ? (
                  <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-700 w-4 h-4 flex items-center justify-center" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}