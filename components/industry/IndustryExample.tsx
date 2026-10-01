import type { IndustryExample } from './types';

interface Props {
  example: IndustryExample;
}

export default function IndustryExample({ example }: Props) {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="example-heading">
      <div className="max-w-4xl mx-auto px-6 md:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-file-list-3-line" aria-hidden="true" />
            Example Requirement
          </div>
          <h2 id="example-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">{example.title}</h2>
          <p className="text-lg text-slate-400">{example.subtitle}</p>
        </div>

        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden">
          <dl className="divide-y divide-slate-700/50 m-0">
            {example.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-6 py-4">
                <dt className="text-sm text-slate-400 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" aria-hidden="true" />
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-white text-right m-0">{row.value}</dd>
              </div>
            ))}
          </dl>
          {example.note && (
            <p className="px-6 py-4 text-xs text-slate-500 bg-[#0e1628] border-t border-slate-700/50 leading-relaxed">
              {example.note}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}