const JOURNEY = [
  {
    title: 'Check availability as a guest',
    desc: 'Enter your venue, shift date and times. The check runs against the matching criteria guards have actually recorded \u2014 their coverage area, travel radius and stated shift availability. It is an indication only: no guard is reserved, held or guaranteed.',
  },
  {
    title: 'Sign in or register a client account',
    desc: 'Sign in, or create a client account. Your plan sets the monthly job posting allowance and the standard booking service fee that applies to each booking, and both are shown in your account.',
  },
  {
    title: 'Review and confirm the posting within your allowance',
    desc: 'Check the location, shift dates and hours, required SIA licence level and the agreed gross guard rate, then publish the job if you still have allowance left this month. Posting a job does not charge the booking payment.',
  },
  {
    title: 'Eligible guards respond',
    desc: 'Guards whose recorded licence, coverage and availability fit the job are notified and can apply. Guard registration, browsing and applications are free, and no paid membership, tier or paid priority reorders applicants.',
  },
  {
    title: 'Select guards \u2014 provisional until payment',
    desc: 'Review the responses and select who you want for the shift. The selection is provisional: the shift is not confirmed and the guard is not committed until the Stripe booking payment completes.',
  },
  {
    title: 'Pay through Stripe to confirm the booking',
    desc: 'Before checkout you see the agreed gross guard pay, your plan\u2019s booking service fee and any eligible promotion. The fee is charged on top of the agreed guard pay, never deducted from it, and payment confirms the booking before the shift.',
  },
  {
    title: 'Check-in and check-out on the shift',
    desc: 'The guard checks in at the start of the shift and checks out at the end, so attendance is recorded against the booked hours.',
  },
  {
    title: 'Completion approval or dispute',
    desc: 'The guard marks the shift complete and you approve it or raise a dispute. An open dispute can pause payment release while it is reviewed under the published policy.',
  },
  {
    title: 'Release checks, Stripe transfer and separate bank payout',
    desc: 'Once approval and the applicable payment, dispute and Stripe account checks are met, eligible guard pay is transferred to the guard\u2019s connected Stripe account. The payout from that Stripe balance to the guard\u2019s own bank account is a separate later step on their payout schedule.',
  },
];

export default function ClientJourney() {
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
            From the guest availability check to the guard being paid, including the separate bank payout stage.
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
          An availability match is not a reservation and does not guarantee cover. Cancellations or disputes can affect payment
          release under the published policy, and existing funded bookings keep their recorded amounts and terms.
        </p>
      </div>
    </section>
  );
}