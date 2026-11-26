import Link from 'next/link';
import { INDUSTRIES } from './industriesContent';

export default function IndustriesGrid() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="industry-list-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-building-4-line" aria-hidden="true" />
            Industry guides
          </div>
          <h2 id="industry-list-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Six sectors, one booking journey
          </h2>
          <p className="text-lg text-slate-400">
            Each guide explains the roles usually requested, the licence that role needs and where a licence is not required at all.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {INDUSTRIES.map((industry) => (
            <li key={industry.href}>
              <Link
                href={industry.href}
                prefetch={false}
                className="group flex flex-col h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 hover:border-teal-500/40 transition-all duration-300"
              >
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 group-hover:bg-teal-500/20 transition-all shrink-0">
                    <i className={`${industry.icon} text-xl text-teal-400`} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-400/20 px-3 py-1 rounded-full whitespace-nowrap">
                    {industry.badge}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-teal-300 transition-colors">
                  {industry.name}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{industry.desc}</p>
                <div className="mt-5 pt-5 border-t border-slate-700/50 flex items-start gap-2.5">
                  <i className="ri-shield-keyhole-line text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-slate-500 leading-relaxed">{industry.licenceNote}</p>
                </div>
                <span className="inline-flex items-center gap-2 mt-5 text-sm font-medium text-teal-400">
                  Open guide
                  <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}