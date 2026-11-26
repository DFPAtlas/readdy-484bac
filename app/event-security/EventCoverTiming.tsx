import type { EventCoverTier } from './eventContent';

interface Props {
  title: string;
  intro: string;
  tiers: EventCoverTier[];
}

export default function EventCoverTiming({ title, intro, tiers }: Props) {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="event-timing-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-time-line" aria-hidden="true" />
            When You Need Cover
          </div>
          <h2 id="event-timing-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-slate-400">{intro}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div key={tier.key} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7">
              <div className={`w-12 h-12 flex items-center justify-center rounded-xl border mb-5 ${tier.bg} ${tier.border}`}>
                <i className={`${tier.icon} text-xl ${tier.color}`} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">{tier.label}</h3>
              <ul className="space-y-3 list-none m-0 p-0">
                {tier.items.map((item) => (
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