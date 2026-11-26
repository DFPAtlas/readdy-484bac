const STEPS = [
  {
    icon: 'ri-calendar-check-line',
    title: 'Check recorded availability',
    desc: 'A guest check counts guards whose recorded availability, travel radius, listed minimum rate and licence type match the shift you describe. It is an indicator only — it reserves nobody and guarantees no cover. No job is posted and no guard is notified at this stage.',
  },
  {
    icon: 'ri-login-box-line',
    title: 'Sign in and confirm the posting',
    desc: 'Sign in or create a company account, then review the requirement and confirm it. Posting is subject to your client plan’s monthly job posting allowance and takes no payment.',
  },
  {
    icon: 'ri-user-search-line',
    title: 'Review the applicants',
    desc: 'Eligible guards can apply once the requirement is posted, at no cost and with no paid membership, tiers or paid priority. Compare profiles, ratings and licence information, then choose.',
  },
  {
    icon: 'ri-bank-card-line',
    title: 'Pay to confirm the booking',
    desc: 'Choosing guards leaves the selection provisional. The booking is confirmed only after your card payment through Stripe succeeds. Your plan’s booking fee is added on top of the agreed gross guard pay, never deducted from it.',
  },
];

export default function RetailBookingSequence() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="retail-sequence-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-list-check-2" aria-hidden="true" />
            Booking sequence
          </div>
          <h2 id="retail-sequence-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            From an availability check to a confirmed shift
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            The order matters, so here is what happens at each stage — and what does not happen yet.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none m-0 p-0">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <span className="text-base font-bold text-teal-400">{index + 1}</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                  <i className={`${step.icon} text-lg text-teal-400`} aria-hidden="true" />
                </div>
              </div>
              <h3 className="font-semibold text-white mb-2 leading-snug">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-slate-500 leading-relaxed text-center max-w-3xl mx-auto">
          Availability comes from records that guards maintain and can change. A check is not a reservation, and no officer is committed
          to your store until the booking payment has completed.
        </p>
      </div>
    </section>
  );
}