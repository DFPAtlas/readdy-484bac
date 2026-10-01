import type { IndustryCard } from './types';

interface Props {
  title: string;
  intro: string;
  problems: IndustryCard[];
}

export default function IndustryProblems({ title, intro, problems }: Props) {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="problems-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-error-warning-line" aria-hidden="true" />
            Common Problems
          </div>
          <h2 id="problems-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-lg text-slate-400">{intro}</p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {problems.map((p) => (
            <li key={p.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300">
              <div className="w-11 h-11 flex items-center justify-center bg-red-500/10 rounded-xl border border-red-500/20 mb-4">
                <i className={`${p.icon} text-xl text-red-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}