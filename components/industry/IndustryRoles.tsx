import type { IndustryRole } from './types';

interface Props {
  title: string;
  intro: string;
  roles: IndustryRole[];
}

export default function IndustryRoles({ title, intro, roles }: Props) {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="roles-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-team-line" aria-hidden="true" />
            Typical Roles
          </div>
          <h2 id="roles-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-lg text-slate-400">{intro}</p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {roles.map((r) => (
            <li key={r.name} className="flex items-start gap-4 bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/30 transition-all duration-300">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-500/10 rounded-xl border border-blue-400/20 shrink-0">
                <i className={`${r.icon} text-xl text-blue-400`} aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1.5">{r.name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{r.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}