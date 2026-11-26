const DUTIES = [
  {
    icon: 'ri-door-lock-line',
    title: 'Access control',
    desc: 'Checking people in and out of the site, confirming contractor and visitor details, logging deliveries and turning away anyone without a reason to be there, in line with your site rules.',
  },
  {
    icon: 'ri-route-line',
    title: 'Patrols',
    desc: 'Walking the hoarding line, compound and plant areas at intervals agreed with you, checking locks, gates and lighting, and recording anything that looks wrong.',
  },
  {
    icon: 'ri-building-2-line',
    title: 'Property guarding',
    desc: 'A static presence at the gatehouse or site cabin, watching entry points and keeping an eye on materials, tools and plant between shifts.',
  },
  {
    icon: 'ri-file-shield-2-line',
    title: 'Incident reporting',
    desc: 'Recording incidents, near misses and access attempts so your site team has a written account of what happened and when.',
  },
];

export default function BuildingSitesDuties() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="duties-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-clipboard-line" aria-hidden="true" />
            Typical duties
          </div>
          <h2 id="duties-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            What a building site security officer usually does
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Duties vary from site to site. These are the activities most often described in a building site requirement, and they
            should be written into the shift details so applicants know what the role involves.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 gap-6 list-none m-0 p-0">
          {DUTIES.map((duty) => (
            <li
              key={duty.title}
              className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300"
            >
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-4">
                <i className={`${duty.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2">{duty.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{duty.desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
              <i className="ri-error-warning-line text-lg text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">The licence should follow the duties, not the job title</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Directing traffic, managing a delivery queue or marshalling vehicles at the gate is generally about site traffic flow
                rather than a licensable security activity. Where a role mixes marshalling with security work, describe both in the
                requirement so the right person and licence type are matched to the duties.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                A guard working with a dog still works under the licence that matches the security activity being carried out; we do
                not claim there is a separate dog handler licence. Licence wording should follow the duties, so check current SIA
                guidance for your situation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}