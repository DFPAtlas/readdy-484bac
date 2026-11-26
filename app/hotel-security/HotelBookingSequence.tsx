const STEPS = [
  {
    icon: 'ri-calendar-check-line',
    title: 'Check recorded availability',
    desc: 'The guest check uses the postcode, shift date and times, required licence type, venue type and the rate you intend to offer. It counts guards whose recorded availability, travel radius, venue preferences, listed minimum rate and licence type fit those details. It is an indicator only — not a reservation and not a guarantee of cover.',
  },
  {
    icon: 'ri-login-box-line',
    title: 'Sign in, review and confirm the posting',
    desc: 'Nothing is posted and no guard is notified at the check stage. Sign in or create a client account, check the location, hours, licence level and agreed gross guard rate, then publish the requirement within your plan’s monthly posting allowance.',
  },
  {
    icon: 'ri-user-add-line',
    title: 'Guards respond to the posting',
    desc: 'Once the requirement is published, guards whose licence, coverage and availability fit are notified and can apply. Guard registration, browsing and applications are free, with no paid membership, paid tiers or paid priority in applicant order.',
  },
  {
    icon: 'ri-user-search-line',
    title: 'Review the applicants and choose',
    desc: 'Compare experience, ratings, the licence details recorded on each profile and the duties each person has covered before. Then select who you want for the shift.',
  },
  {
    icon: 'ri-checkbox-circle-line',
    title: 'Selection is provisional',
    desc: 'Choosing guards does not secure the night. Until the payment completes, the selection is provisional, the shift is not confirmed and no officer is committed to your venue.',
  },
  {
    icon: 'ri-bank-card-line',
    title: 'Payment confirms the booking',
    desc: 'Before checkout you see the agreed gross guard pay, your plan’s booking service fee and any eligible promotion. The fee is charged on top of the agreed guard pay, never deducted from it, and QuickGuard takes no booking commission on new guard bookings. The booking is confirmed only when the Stripe payment succeeds.',
  },
];

export default function HotelBookingSequence() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="hotel-sequence-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-list-check-2" aria-hidden="true" />
            Booking sequence
          </div>
          <h2 id="hotel-sequence-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            From an availability check to a confirmed night
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            The order matters, so here is what happens at each stage and what has not happened yet.
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
          Availability is counted from records that guards maintain and can change at any time. A check holds nobody, and no officer
          is committed to your venue until the booking payment has completed.
        </p>
      </div>
    </section>
  );
}