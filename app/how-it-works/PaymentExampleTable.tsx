const ROWS = [
  { plan: 'Free', price: '£0', fee: '15%', feeAmount: '£15.00', total: '£115.00' },
  { plan: 'Starter', price: '£49/mo or £490/yr', fee: '10%', feeAmount: '£10.00', total: '£110.00' },
  { plan: 'Pro', price: '£99/mo or £990/yr', fee: '7.5%', feeAmount: '£7.50', total: '£107.50' },
  { plan: 'Enterprise', price: '£199/mo or £1,990/yr', fee: '5%', feeAmount: '£5.00', total: '£105.00' },
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
            £100 agreed guard pay, before any eligible promotions. Booking fees are calculated on agreed guard pay.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="py-4 pr-4 text-sm font-semibold text-slate-400">Plan</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Subscription</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Service fee</th>
                <th className="py-4 px-4 text-sm font-semibold text-slate-400">Fee on £100</th>
                <th className="py-4 px-4 text-sm font-semibold text-teal-400 bg-teal-500/5">Client total</th>
                <th className="py-4 pl-4 text-sm font-semibold text-slate-400">Guard receives</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.plan} className="border-b border-slate-800/50 hover:bg-[#111d35]/30 transition-colors">
                  <td className="py-4 pr-4 text-sm font-semibold text-white whitespace-nowrap">{row.plan}</td>
                  <td className="py-4 px-4 text-sm text-slate-300 whitespace-nowrap">{row.price}</td>
                  <td className="py-4 px-4 text-sm text-slate-300">{row.fee}</td>
                  <td className="py-4 px-4 text-sm text-slate-300">{row.feeAmount}</td>
                  <td className="py-4 px-4 text-sm font-semibold text-teal-300 bg-teal-500/5">{row.total}</td>
                  <td className="py-4 pl-4 text-sm font-semibold text-white">£100.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-sm text-slate-400 leading-relaxed max-w-3xl">
          The guard receives the full £100 under every plan. Payment processing and standard guard payouts are included,
          there is no separate Stripe or card surcharge, and eligible existing promotions reduce the service fee. The final
          amount is always shown before checkout, and tax is only shown where supported by the implemented checkout.
        </p>
      </div>
    </section>
  );
}