export default function SubscriptionVsBooking() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="sub-vs-booking-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-money-pound-circle-line" />
            Two Separate Charges
          </div>
          <h2 id="sub-vs-booking-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Subscription vs Booking Payments
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Your plan and each booking are billed separately and cover different things.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/30 transition-all">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-5">
              <i className="ri-repeat-line text-2xl text-teal-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Your subscription</h3>
            <ul className="space-y-3 text-sm text-slate-400 list-none p-0 m-0">
              {[
                'Pays for platform features and your monthly job posting allowance',
                'Sets the booking service fee that applies to each booking',
                'Higher plans carry a lower booking service fee',
                'Billed monthly or annually — annual saves two months',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-400 text-xs mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
            <div className="w-12 h-12 flex items-center justify-center bg-blue-500/10 rounded-xl border border-blue-400/20 mb-5">
              <i className="ri-secure-payment-line text-2xl text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Each booking</h3>
            <ul className="space-y-3 text-sm text-slate-400 list-none p-0 m-0">
              {[
                'Guard services are paid separately for every booking',
                'A subscription never covers the guard\u2019s pay',
                'The booking total is the agreed guard pay plus your plan\u2019s service fee',
                'Paid securely through Stripe before the booking is confirmed',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <i className="ri-check-line text-blue-400 text-xs mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400 max-w-3xl mx-auto leading-relaxed">
          No plan removes booking fees entirely — every client pays a booking service fee on each booking, and that fee is
          lower on higher plans. There is no separate Stripe or card surcharge: payment processing is included, and standard
          guard payouts are covered by the client booking service fee.
        </p>
      </div>
    </section>
  );
}