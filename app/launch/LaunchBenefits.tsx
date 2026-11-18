const BENEFITS = [
  {
    icon: 'ri-verified-badge-line',
    title: 'Verified SIA-licensed guards',
    desc: 'Every guard on QuickGuard must hold a valid SIA licence and pass a licence check before taking work.',
  },
  {
    icon: 'ri-flashlight-line',
    title: 'Fast booking',
    desc: 'Describe the shift, review available guards and confirm cover without agency paperwork or long contracts.',
  },
  {
    icon: 'ri-safe-2-line',
    title: 'Secure payments',
    desc: 'Booking payments are processed securely through Stripe, with guard payouts handled on the platform.',
  },
];

export default function LaunchBenefits() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why QuickGuard</h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            A straightforward marketplace for UK security work — built for the businesses that need cover and the guards who provide it.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit.title}
              className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 hover:border-teal-500/40 transition-all duration-300"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-5">
                <i className={`${benefit.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{benefit.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}