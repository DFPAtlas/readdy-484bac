import type { IndustryCard } from './types';

interface Props {
  title: string;
  intro: string;
  solutions: IndustryCard[];
}

export default function IndustrySolutions({ title, intro, solutions }: Props) {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="solutions-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-lightbulb-flash-line" aria-hidden="true" />
            How QuickGuard Helps
          </div>
          <h2 id="solutions-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-lg text-slate-400">{intro}</p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none m-0 p-0">
          {solutions.map((s) => (
            <li key={s.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300">
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-4">
                <i className={`${s.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}