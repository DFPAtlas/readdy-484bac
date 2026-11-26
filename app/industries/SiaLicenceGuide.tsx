import { LICENCE_ROLES, NON_LICENSABLE_ROLES } from './industriesContent';

export default function SiaLicenceGuide() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="licence-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-shield-check-line" aria-hidden="true" />
            Licences by role
          </div>
          <h2 id="licence-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Licensing follows the duty, not the industry
          </h2>
          <p className="text-lg text-slate-400">
            Many people assume every person in a uniform needs an SIA licence. That is not the case. What matters is the activity being
            carried out, and each job states the licence level it requires.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden">
            <dl className="divide-y divide-slate-700/50 m-0">
              {LICENCE_ROLES.map((role) => (
                <div key={role.role} className="px-6 py-5">
                  <dt className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-white">{role.role}</span>
                    <span className="text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-400/20 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      {role.licence}
                    </span>
                  </dt>
                  <dd className="text-sm text-slate-400 leading-relaxed m-0">{role.note}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-2 bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
            <div className="w-11 h-11 flex items-center justify-center bg-slate-500/10 border border-slate-600/40 rounded-xl mb-4">
              <i className="ri-user-unfollow-line text-xl text-slate-300" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-white mb-2">Roles that are not automatically licensable</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              These duties do not need an SIA licence in themselves, so do not assume a licence is required or that one is held:
            </p>
            <ul className="space-y-2.5 list-none m-0 p-0">
              {NON_LICENSABLE_ROLES.map((role) => (
                <li key={role} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <i className="ri-subtract-line mt-0.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="leading-relaxed">{role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 pt-5 border-t border-slate-700/50 text-xs text-slate-500 leading-relaxed">
              Where a role does involve licensable activity, licence details are recorded on guard profiles so you can review them
              against the job before you select anyone. Check the SIA&rsquo;s current guidance for the specific duty if you are unsure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}