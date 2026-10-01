const JOURNEY = [
  { title: 'Create an account and choose a plan', desc: 'Register and pick the plan that fits your booking volume. Your plan sets your posting allowance and service fee.' },
  { title: 'Post a job within your plan\u2019s allowance', desc: 'Describe the shift in minutes. Posting a job does not charge the booking payment.' },
  { title: 'Review applicants and select guards', desc: 'Compare verified, SIA-licensed applicants and choose who you want for the shift.' },
  { title: 'Review your booking total', desc: 'See the agreed guard pay, your plan\u2019s service fee, any eligible promotion, and the final booking total.' },
  { title: 'Pay securely through Stripe', desc: 'Payment is taken through Stripe before the booking is confirmed.' },
  { title: 'Funds remain with Stripe', desc: 'Your payment is held pending completion and the applicable release checks.' },
  { title: 'Guard payment is released', desc: 'After completion, guard pay is released under the existing confirmation, dispute and payout process.' },
];

export default function ClientBookingJourney() {
  return (
    <section className="py-24 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="client-journey-heading">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-route-line" />
            Client Booking Journey
          </div>
          <h2 id="client-journey-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            How Booking and Payment Works
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            The full journey from choosing a plan to the guard being paid — with no charge at the point of posting.
          </p>
        </div>

        <ol className="space-y-5 list-none p-0 m-0">
          {JOURNEY.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-5 bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 hover:border-teal-500/30 transition-all"
            >
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-teal-500/10 border border-teal-400/20 shrink-0">
                <span className="text-base font-bold text-teal-400">{i + 1}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white mb-1">{step.title}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-slate-400 leading-relaxed bg-[#111d35] border border-slate-700/50 rounded-2xl p-5">
          Cancellations or disputes can affect payment release under the published policy. Existing funded bookings keep
          their recorded amounts and terms.
        </p>
      </div>
    </section>
  );
}