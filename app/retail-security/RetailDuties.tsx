const DUTIES = [
  {
    icon: 'ri-search-eye-line',
    title: 'Loss prevention duties',
    desc: 'Watching the shop floor, noticing activity that looks out of place and following your store’s documented procedures, including how your team records and escalates an incident.',
  },
  {
    icon: 'ri-door-lock-line',
    title: 'Access control',
    desc: 'Covering the entrance, back door or loading bay, checking staff and contractor access and keeping a record of who came in and when.',
  },
  {
    icon: 'ri-route-line',
    title: 'Patrols',
    desc: 'Walking agreed routes through the floor, stockroom and high-value aisles at intervals you set, checking fire exits, fitting rooms and shutter points.',
  },
  {
    icon: 'ri-camera-line',
    title: 'CCTV monitoring',
    desc: 'Where the role includes monitoring cameras that counts as public space surveillance, the operative needs an SIA CCTV (PSS) licence. Not every in-store camera check is a PSS activity.',
  },
  {
    icon: 'ri-file-shield-2-line',
    title: 'Reporting and handover',
    desc: 'Recording incidents, refusals and access attempts so your store team has a written account and a clear handover at the end of the shift.',
  },
];

export default function RetailDuties() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="retail-duties-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-clipboard-line" aria-hidden="true" />
            Typical duties
          </div>
          <h2 id="retail-duties-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            What a retail security role usually covers
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Duties differ from store to store, so write them into the shift details. These are the activities most often described in
            a retail requirement, and they are what the licence type should be matched against.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
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
              <i className="ri-scales-3-line text-lg text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Customer service is not the same as licensable activity</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Greeting shoppers, answering questions, helping at a queue or pointing someone towards a department is general
                customer service. On its own it is not a licensable security activity, even when it is done by someone in a uniform.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Guarding duties, door supervision and public space surveillance CCTV are different matters, and the SIA licence has to
                match the activity actually carried out. Where a role mixes shop-floor assistance with guarding duties, describe both in
                the requirement so the licence and the person fit the work. Check current SIA guidance for your own situation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}