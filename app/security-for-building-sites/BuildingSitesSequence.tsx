const STEPS = [
  {
    icon: 'ri-calendar-check-line',
    title: 'Check recorded availability',
    desc: 'A guest check counts guards whose recorded availability, travel distance, listed minimum rate and licence type match the shift you describe. It reserves nobody and does not guarantee cover, and guards still decide whether to accept work.',
  },
  {
    icon: 'ri-login-box-line',
    title: 'Sign in or register',
    desc: 'Nothing is posted and no guard is notified at the check stage. Sign in or create a company account, then review your requirement before confirming the posting.',
  },
  {
    icon: 'ri-file-list-3-line',
    title: 'Post within your allowance',
    desc: 'Posting is subject to your client plan’s monthly job posting allowance. Posting on its own takes no payment and creates no booking.',
  },
  {
    icon: 'ri-user-search-line',
    title: 'Review the applicants',
    desc: 'Eligible guards can apply once the requirement is posted. Applications are free, with no application cap and no paid membership, tiers or paid priority. Compare profiles, experience, ratings and the licence information shown.',
  },
  {
    icon: 'ri-bank-card-line',
    title: 'Pay to confirm the booking',
    desc: 'Choosing guards leaves the selection provisional. The booking is confirmed only after your card payment through Stripe succeeds. Your plan’s booking service fee is charged on top of the agreed gross guard pay, never deducted from it, and no QuickGuard booking commission is deducted on new bookings.',
  },
];

export default function BuildingSitesSequence() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="sequence-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-list-check-2" aria-hidden="true" />
            Booking sequence
          </div>
          <h2 id="sequence-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            From an availability check to a confirmed shift
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            The order matters, so here is what happens at each stage on a building site requirement — and what does not happen yet.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
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
          Availability is counted from records that guards maintain and can change at any time. No officer is committed to your site
          until the booking payment has completed.
        </p>
      </div>
    </section>
  );
}