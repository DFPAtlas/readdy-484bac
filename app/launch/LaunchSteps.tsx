const STEPS = [
  {
    number: '1',
    icon: 'ri-user-add-line',
    title: 'Sign up',
    desc: 'Create a client account for your business, or a guard account with your SIA licence details.',
  },
  {
    number: '2',
    icon: 'ri-shield-check-line',
    title: 'Get verified',
    desc: 'Guards complete an SIA licence check. Clients confirm their business details before booking.',
  },
  {
    number: '3',
    icon: 'ri-calendar-check-line',
    title: 'Start booking or start working',
    desc: 'Clients book guards for shifts, and guards apply for work that fits around their schedule.',
  },
];

export default function LaunchSteps() {
  return (
    <section className="py-20 bg-[#0B1933] border-y border-slate-800/60">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Three steps from signup to your first shift on QuickGuard.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none m-0 p-0">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="relative bg-[#111d35] border border-slate-700/50 rounded-2xl p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                  <i className={`${step.icon} text-xl text-teal-400`} aria-hidden="true" />
                </div>
                <span className="w-9 h-9 flex items-center justify-center rounded-full bg-teal-500 text-slate-900 text-sm font-bold">
                  {step.number}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-amber-200/80">
          No subscription fee for December — applied automatically, no code needed.
        </p>
      </div>
    </section>
  );
}