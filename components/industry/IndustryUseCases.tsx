import type { IndustryUseCases } from './types';

interface Props {
  useCases: IndustryUseCases;
}

const TIERS = [
  { key: 'planned' as const, label: 'Planned Cover', icon: 'ri-calendar-schedule-line', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-400/20' },
  { key: 'shortNotice' as const, label: 'Short-Notice Cover', icon: 'ri-timer-flash-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { key: 'emergency' as const, label: 'Emergency Cover', icon: 'ri-alarm-warning-line', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
];

export default function IndustryUseCases({ useCases }: Props) {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="usecases-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-time-line" aria-hidden="true" />
            When You Need Cover
          </div>
          <h2 id="usecases-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Planned, Short-Notice and Emergency Support
          </h2>
          <p className="text-lg text-slate-400">
            Whether you are scheduling weeks ahead or filling a gap today, QuickGuard helps you find available operatives.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div key={tier.key} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7">
              <div className={`w-12 h-12 flex items-center justify-center rounded-xl border mb-5 ${tier.bg} ${tier.border}`}>
                <i className={`${tier.icon} text-xl ${tier.color}`} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">{tier.label}</h3>
              <ul className="space-y-3 list-none m-0 p-0">
                {useCases[tier.key].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <i className={`ri-check-line mt-0.5 ${tier.color}`} aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}