const STEPS = [
  { icon: 'ri-file-list-3-line', title: 'Post your requirement', desc: 'Describe the shift — role, location, dates, times and how many operatives you need.' },
  { icon: 'ri-robot-line', title: 'Match with available operatives', desc: 'QuickGuard surfaces suitable, available professionals near you, including short-notice cover.' },
  { icon: 'ri-user-search-line', title: 'Review profiles and licence information', desc: 'Compare experience, ratings and the licence information shown on each profile before you choose.' },
  { icon: 'ri-checkbox-circle-line', title: 'Confirm the shift', desc: 'Select your operatives and confirm the booking through the existing QuickGuard flow.' },
  { icon: 'ri-shield-check-line', title: 'Complete and manage the job', desc: 'Run the shift, track completion and manage the booking end-to-end through QuickGuard.' },
];

export default function IndustryHowItWorks() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="hiw-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-list-check-2" aria-hidden="true" />
            How QuickGuard Works
          </div>
          <h2 id="hiw-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Five Simple Steps
          </h2>
          <p className="text-lg text-slate-400">
            The same straightforward process whatever the industry — from posting your requirement to managing the job.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 list-none m-0 p-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300">
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-4">
                <span className="text-lg font-bold text-teal-400">{i + 1}</span>
              </div>
              <div className="w-8 h-8 flex items-center justify-center mb-3">
                <i className={`${step.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm leading-snug">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}