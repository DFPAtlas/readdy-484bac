import Link from 'next/link';
import {
  QUICKGUARD_TAX_NOTE,
  bookingFeeText,
  planAllowanceText,
  pricingMoney,
  type PublicPricingPlan,
} from '@/lib/public-pricing';

export default function ClientPlanFacts({
  plans,
  loading,
  error,
  feesError,
  retry,
}: {
  plans: PublicPricingPlan[];
  loading: boolean;
  error: string | null;
  feesError: boolean;
  retry: () => void;
}) {
  const clientPlans = plans.filter((plan) => plan.audience === 'client');

  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="plan-facts-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-table-line" />
            Current Plans
          </div>
          <h2 id="plan-facts-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Client Plans and Standard Fees
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Monthly prices, posting allowances and standard booking service fees are read live from the current pricing records
            rather than copied into this page.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-700/50 bg-[#111d35] py-14 text-slate-400">
            <i className="ri-loader-4-line animate-spin text-2xl text-teal-400" />
            Loading current pricing…
          </div>
        )}

        {!loading && (error || feesError) && (
          <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-200">
            <p className="text-sm leading-relaxed">
              The current plan details could not be confirmed, so no prices are shown here. Your final booking service fee is always
              shown before you confirm payment.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && !feesError && clientPlans.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-4 pr-4 text-sm font-semibold text-slate-400">Plan</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Monthly subscription</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Posting allowance</th>
                  <th className="py-4 pl-4 text-sm font-semibold text-teal-400 bg-teal-500/5">Standard booking service fee</th>
                </tr>
              </thead>
              <tbody>
                {clientPlans.map((plan) => (
                  <tr key={plan.slug} className="border-b border-slate-800/50 hover:bg-[#111d35]/30 transition-colors">
                    <td className="py-4 pr-4 text-sm font-semibold text-white whitespace-nowrap">{plan.name}</td>
                    <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{pricingMoney(plan.monthly_price_pence)}</td>
                    <td className="py-4 px-4 text-sm text-slate-300">{planAllowanceText(plan)}</td>
                    <td className="py-4 pl-4 text-sm font-semibold text-teal-300 bg-teal-500/5">{bookingFeeText(plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 space-y-3 text-sm text-slate-400 leading-relaxed">
          <p>
            The booking service fee is separate from your subscription and is charged on top of the agreed gross guard pay, never
            taken out of it. An eligible promotion can reduce the fee, including to zero where that promotion supports it, and the
            amount that applies is shown before you confirm payment.
          </p>
          <p>{QUICKGUARD_TAX_NOTE}</p>
          <p>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium">
              <i className="ri-arrow-right-line" /> View the full pricing page
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}