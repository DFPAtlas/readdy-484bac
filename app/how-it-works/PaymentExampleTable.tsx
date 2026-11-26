const ROWS = [
  { plan: 'Free Starter', price: '£0', allowance: '1 job / month', fee: '15%', feeAmount: '£15.00', total: '£115.00' },
  { plan: 'Client Starter', price: '£49', allowance: '10 jobs / month', fee: '10%', feeAmount: '£10.00', total: '£110.00' },
  { plan: 'Client Pro', price: '£99', allowance: '30 jobs / month', fee: '7.5%', feeAmount: '£7.50', total: '£107.50' },
  { plan: 'Client Enterprise', price: '£199', allowance: 'Unlimited jobs', fee: '5%', feeAmount: '£5.00', total: '£105.00' },
];

export default function PaymentExampleTable() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="payment-example-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-calculator-line" />
            Worked Example
          </div>
          <h2 id="payment-example-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Payment Example
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            £100 agreed guard pay for one booking, before any eligible promotion. The service fee is added to the client total and is
            never deducted from the agreed guard pay.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="py-4 pr-4 text-sm font-semibold text-slate-400">Plan</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Monthly subscription</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Posting allowance</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Service fee</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Fee on £100</th>
                <th className="py-4 px-4 text-sm font-semibold text-teal-400 bg-teal-500/5">Client total</th>
                <th className="py-4 pl-4 text-sm font-semibold text-slate-400">Guard gross pay</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.plan} className="border-b border-slate-800/50 hover:bg-[#111d35]/30 transition-colors">
                  <td className="py-4 pr-4 text-sm font-semibold text-white whitespace-nowrap">{row.plan}</td>
                  <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{row.price}/month</td>
                  <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{row.allowance}</td>
                  <td className="py-4 px-4 text-sm text-slate-300">{row.fee}</td>
                  <td className="py-4 px-4 text-sm text-slate-300">{row.feeAmount}</td>
                  <td className="py-4 px-4 text-sm font-semibold text-teal-300 bg-teal-500/5">{row.total}</td>
                  <td className="py-4 pl-4 text-sm font-semibold text-white whitespace-nowrap">£100.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-sm text-slate-400 leading-relaxed max-w-3xl">
          The guard receives the agreed £100 on new bookings under every plan, with no platform or Stripe deduction taken from that
          gross pay. The subscription is a separate monthly charge, and a separate booking payment applies each time you fund a
          booking. Eligible promotions can reduce the service fee, and the final amount is always shown before checkout.
        </p>
      </div>
    </section>
  );
}