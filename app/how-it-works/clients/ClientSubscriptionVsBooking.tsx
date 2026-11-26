import { QUICKGUARD_TAX_NOTE } from '@/lib/public-pricing';

const COLUMNS = [
  {
    icon: 'ri-repeat-line',
    accent: 'teal',
    title: 'Your subscription',
    items: [
      'A separate monthly charge for platform services and your job posting allowance',
      'Sets the standard booking service fee that applies to each booking',
      'Your allowance and fee are shown in your account and on the pricing page',
      'Cancelling renewal stops the next charge and takes effect at the end of the current period',
    ],
  },
  {
    icon: 'ri-secure-payment-line',
    accent: 'blue',
    title: 'The booking service fee',
    items: [
      'Charged once per booking, on top of the agreed gross guard pay',
      'Paid through Stripe before the booking is confirmed',
      'Eligible promotions can reduce it, including to zero where that promotion supports it',
      'The exact amount that applies is shown before you confirm payment',
    ],
  },
  {
    icon: 'ri-hand-coin-line',
    accent: 'teal',
    title: 'The agreed gross guard pay',
    items: [
      'The hourly rate you agree with the guard, multiplied by the booked hours',
      'Not reduced by a platform or booking commission on new bookings',
      'Released to the guard only after completion approval and the applicable checks',
      'Transferred to the guard\u2019s connected Stripe account, with the bank payout a separate later step',
    ],
  },
];

export default function ClientSubscriptionVsBooking() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="three-charges-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-money-pound-circle-line" />
            Three Separate Amounts
          </div>
          <h2 id="three-charges-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Subscription, Service Fee and Guard Pay
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            These are three different amounts. A subscription never covers guard pay, and the service fee never comes out of it.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {COLUMNS.map((column) => (
            <article
              key={column.title}
              className={`bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 transition-all ${
                column.accent === 'blue' ? 'hover:border-blue-500/30' : 'hover:border-teal-500/30'
              }`}
            >
              <div
                className={`w-12 h-12 flex items-center justify-center rounded-xl border mb-5 ${
                  column.accent === 'blue'
                    ? 'bg-blue-500/10 border-blue-400/20'
                    : 'bg-teal-500/10 border-teal-400/20'
                }`}
              >
                <i
                  className={`${column.icon} text-2xl ${
                    column.accent === 'blue' ? 'text-blue-400' : 'text-teal-400'
                  }`}
                />
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">{column.title}</h3>
              <ul className="space-y-3 text-sm text-slate-400 list-none p-0 m-0">
                {column.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <i
                      className={`ri-check-line text-xs mt-1 ${
                        column.accent === 'blue' ? 'text-blue-400' : 'text-teal-400'
                      }`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400 max-w-3xl mx-auto leading-relaxed">
          There is no separate card surcharge: standard Stripe payment processing is included in the client charges. {QUICKGUARD_TAX_NOTE}
        </p>
      </div>
    </section>
  );
}