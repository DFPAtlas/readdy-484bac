const POINTS = [
  {
    icon: 'ri-money-pound-circle-line',
    title: 'Guard pay is the agreed gross rate',
    desc: 'The hourly rate you set is the gross pay the guard receives for the hours booked. It is not reduced by a platform commission on new bookings.',
  },
  {
    icon: 'ri-receipt-line',
    title: 'Your booking fee sits on top',
    desc: 'Your client plan’s booking service fee is calculated on that agreed gross guard pay and added on top of it — never taken out of the guard’s amount.',
  },
  {
    icon: 'ri-coupon-3-line',
    title: 'Promotions are shown first',
    desc: 'Where your account is eligible for a promotion, the reduced fee is displayed before you pay, along with the total you are being asked to approve.',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'No escrow arrangement',
    desc: 'Payment is taken by card through Stripe when the booking is confirmed. There is no escrow, and the payout to the guard’s Stripe account is a separate later step after completion approval and the applicable checks.',
  },
];

export default function RetailCostNote() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="retail-cost-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-money-pound-circle-line" aria-hidden="true" />
            What you pay
          </div>
          <h2 id="retail-cost-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            The client booking fee, explained plainly
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            One booking produces two separate figures: what the guard is paid, and what you pay on top for using QuickGuard. Both are
            visible before you confirm payment, and posting a job on its own costs nothing.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 gap-6 list-none m-0 p-0">
          {POINTS.map((point) => (
            <li key={point.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-4">
                <i className={`${point.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2">{point.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{point.desc}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-slate-500 leading-relaxed max-w-3xl">
          Your plan also sets a monthly job posting allowance, and any subscription is billed separately from booking payments. The exact
          fee percentage for your plan is shown in your pricing page and again at checkout; this section explains how it is applied, not a
          fixed rate.
        </p>
      </div>
    </section>
  );
}