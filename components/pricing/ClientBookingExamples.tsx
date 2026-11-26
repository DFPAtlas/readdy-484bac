import { bookingAmounts } from '@/lib/booking-policy';
import { QUICKGUARD_TAX_NOTE, bookingFeeText, pricingMoney, type PublicPricingPlan } from '@/lib/public-pricing';

const EXAMPLE_HOURS = 8;
const EXAMPLE_RATE = 18;
const GROSS_PENCE = EXAMPLE_HOURS * EXAMPLE_RATE * 100;

export default function ClientBookingExamples({ plans, print = false }: { plans: PublicPricingPlan[]; print?: boolean }) {
  const clients = plans.filter(plan => plan.audience === 'client');
  return (
    <section className={`my-10 rounded-2xl border p-5 ${print ? 'border-slate-200 text-slate-800' : 'border-slate-700/50 bg-[#111d35] text-slate-300'}`} aria-labelledby="booking-example-heading">
      <h2 id="booking-example-heading" className={`text-xl font-bold mb-3 ${print ? 'text-slate-900' : 'text-white'}`}>Example: one guard, 8 hours at £18/hour</h2>
      <p className="text-sm mb-4">
        {pricingMoney(GROSS_PENCE)} agreed gross guard pay for the shift. The guard receives that agreed pay in full; the booking service fee is added for the client and is not taken from guard pay. Monthly subscription is additional. These standard examples exclude promotions and any statutory payroll adjustments or employer costs, and do not represent take-home pay. {QUICKGUARD_TAX_NOTE}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Standard booking cost by client plan</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2">Client plan</th>
              <th scope="col" className="p-2">Subscription/month</th>
              <th scope="col" className="p-2">Booking service fee</th>
              <th scope="col" className="p-2">Client booking total</th>
              <th scope="col" className="p-2">Guard gross pay</th>
            </tr>
          </thead>
          <tbody>{clients.map(plan => {
            const amounts = plan.bookingFee === undefined || plan.bookingFeeFixedPence === undefined
              ? null
              : bookingAmounts(GROSS_PENCE, plan.bookingFee, plan.bookingFeeFixedPence);
            return (
              <tr key={plan.slug} className="border-t border-slate-500/20">
                <th scope="row" className="p-2 font-semibold">{plan.name}</th>
                <td className="p-2">{pricingMoney(plan.monthly_price_pence)}</td>
                <td className="p-2">{amounts ? `${bookingFeeText(plan)} (${pricingMoney(amounts.platformFeePence)})` : 'Fee unavailable'}</td>
                <td className="p-2">{amounts ? pricingMoney(amounts.clientTotalPence) : 'Total unavailable'}</td>
                <td className="p-2">{pricingMoney(GROSS_PENCE)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="text-sm mt-4">Your subscription covers the services and posting allowance shown for your tier. A separate booking service fee applies when you fund a booking. Standard payment processing is included in these client charges.</p>
    </section>
  );
}