const JOURNEY = [
  {
    title: 'Check guard availability as a guest',
    desc: 'Enter your venue, shift date and times to see whether guards indicate availability for that area and time. A match is not a reservation, does not hold a guard and does not guarantee cover.',
  },
  {
    title: 'Sign in or create a client account',
    desc: 'Sign in to an existing account or register a free client account. Your plan sets your monthly posting allowance and the booking service fee that applies to each booking.',
  },
  {
    title: 'Review and confirm your job posting',
    desc: 'Check the location, shift hours, required SIA licence level and agreed guard hourly rate, then publish the job within your plan allowance of 1, 10, 30 or unlimited jobs per month. Posting does not charge the booking payment.',
  },
  {
    title: 'Eligible guards respond',
    desc: 'Guards whose licence, coverage and availability fit the job are notified and can apply. Applications are free for guards and are not ordered or prioritised by any paid tier.',
  },
  {
    title: 'Your selection is provisional until payment',
    desc: 'Review responses and select the guards you want. The selection is provisional and the shift is not confirmed until the Stripe booking payment completes.',
  },
  {
    title: 'Payment confirms the booking',
    desc: 'Before checkout you see the agreed guard pay, your plan\u2019s service fee and any eligible promotion. The service fee is added to the client total and is not deducted from the agreed guard pay.',
  },
  {
    title: 'Shift check-in, check-out and completion',
    desc: 'The guard checks in at the start of the shift and checks out at the end. The guard then marks the shift complete or requests completion for the client to review.',
  },
  {
    title: 'Approval or dispute, release checks and payout',
    desc: 'The client approves completion or raises a dispute, and an open dispute can pause release. After approval and the applicable payment, dispute and Stripe account checks, eligible pay is released to the guard\u2019s connected Stripe account. The bank payout is a separate later step on the guard\u2019s payout schedule.',
  },
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
            The full journey from a guest availability check to the guard being paid, including the separate bank payout stage.
          </p>
        </div>

        <ol className="space-y-5 list-none p-0 m-0">
          {JOURNEY.map((step, i) => (
            <li
              key={step.title}
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
          Posting a job does not charge the booking payment, and no guard is reserved by an availability check. Cancellations or
          disputes can affect payment release under the published policy. Existing funded bookings keep their recorded amounts and terms.
        </p>
      </div>
    </section>
  );
}