import { bookingAmounts } from '@/lib/booking-policy';
import {
  QUICKGUARD_TAX_NOTE,
  bookingFeeText,
  planAllowanceText,
  pricingMoney,
  type PublicPricingPlan,
} from '@/lib/public-pricing';

const EXAMPLE_GROSS_PENCE = 10000;

export default function ClientPricingExample({
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
  const clientPlans = plans.filter((plan) => plan.audience === 'client' && typeof plan.bookingFee === 'number');
  const unavailable = !loading && (!!error || feesError || clientPlans.length === 0);

  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="client-example-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-calculator-line" />
            Worked Example
          </div>
          <h2 id="client-example-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Agreed Pay, Service Fee and Total
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            One booking with £100.00 of agreed gross guard pay, calculated with each plan&apos;s current standard booking service fee
            before any eligible promotion.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-700/50 bg-[#111d35] py-14 text-slate-400">
            <i className="ri-loader-4-line animate-spin text-2xl text-teal-400" />
            Loading the current service fees…
          </div>
        ) : unavailable ? (
          <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-200">
            <p className="text-sm leading-relaxed">
              The current service fees could not be confirmed, so this example is not shown. The fee that applies to your booking is
              always shown before you confirm payment.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" /> Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-4 pr-4 text-sm font-semibold text-slate-400">Plan</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Monthly subscription</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Posting allowance</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Standard fee</th>
                  <th className="py-4 px-4 text-sm font-semibold text-slate-400">Fee on £100.00</th>
                  <th className="py-4 px-4 text-sm font-semibold text-teal-400 bg-teal-500/5">Client total</th>
                  <th className="py-4 pl-4 text-sm font-semibold text-slate-400">Guard gross pay</th>
                </tr>
              </thead>
              <tbody>
                {clientPlans.map((plan) => {
                  const amounts = bookingAmounts(
                    EXAMPLE_GROSS_PENCE,
                    plan.bookingFee ?? 0,
                    plan.bookingFeeFixedPence ?? 0
                  );
                  return (
                    <tr key={plan.slug} className="border-b border-slate-800/50 hover:bg-[#111d35]/30 transition-colors">
                      <td className="py-4 pr-4 text-sm font-semibold text-white whitespace-nowrap">{plan.name}</td>
                      <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{pricingMoney(plan.monthly_price_pence)}</td>
                      <td className="py-4 px-4 text-sm text-slate-300">{planAllowanceText(plan)}</td>
                      <td className="py-4 px-4 text-sm text-slate-300">{bookingFeeText(plan)}</td>
                      <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{pricingMoney(amounts.platformFeePence)}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-teal-300 bg-teal-500/5 whitespace-nowrap">
                        {pricingMoney(amounts.clientTotalPence)}
                      </td>
                      <td className="py-4 pl-4 text-sm font-semibold text-white whitespace-nowrap">
                        {pricingMoney(amounts.guardNetPence)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 space-y-2 text-sm text-slate-400 leading-relaxed max-w-3xl">
          <p>
            The subscription is a separate monthly charge. On new bookings the agreed gross guard pay is not reduced by a platform or
            booking commission, and the service fee is added to the client total instead. Where an eligible promotion applies, the
            service fee can be lower and can reach zero if that promotion supports it; the exact amount is shown before checkout.
          </p>
          <p>{QUICKGUARD_TAX_NOTE}</p>
        </div>
      </div>
    </section>
  );
}