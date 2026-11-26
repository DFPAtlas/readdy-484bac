const DUTIES = [
  {
    icon: 'ri-hotel-line',
    title: 'Reception and front-of-house presence',
    desc: 'A calm, uniformed presence near the desk and lobby: watching arrivals, noticing who is where, and stepping in when a guest, visitor or delivery becomes difficult so front-desk staff can keep serving.',
  },
  {
    icon: 'ri-door-lock-line',
    title: 'Access control',
    desc: 'Staff entrances, back-of-house corridors, service yards and car parks kept to the people who should be using them, with visitors logged and doors checked rather than propped.',
  },
  {
    icon: 'ri-route-line',
    title: 'Patrols',
    desc: 'Walking the building, function rooms, back-of-house and grounds at intervals agreed with your duty manager, checking fire exits, locks and lighting, and recording what was found.',
  },
  {
    icon: 'ri-calendar-event-line',
    title: 'Function and event cover',
    desc: 'Wedding receptions, conferences and party nights where guest numbers and hours run beyond the normal front-desk routine, including the arrival and departure peaks.',
  },
  {
    icon: 'ri-goblet-line',
    title: 'Licensed premises security',
    desc: 'Where a function bar or event involves door supervision activity, that duty is described in the requirement so someone holding the matching licence can be matched to it.',
  },
  {
    icon: 'ri-file-shield-2-line',
    title: 'Incident handling and reporting',
    desc: 'A first, calm response to a refusal, a disagreement or an uninvited visitor, followed by a written account of what happened for your duty manager and, where relevant, the police.',
  },
];

export default function HotelDuties() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="hotel-duties-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-clipboard-line" aria-hidden="true" />
            Typical duties
          </div>
          <h2 id="hotel-duties-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            What hospitality security usually covers
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Every venue is different. These are the duties most often written into a hotel or hospitality requirement, and they
            belong in the shift details so the people applying know what the night actually involves.
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

        <div className="mt-8 bg-[#111d35] border border-amber-500/20 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
              <i className="ri-error-warning-line text-lg text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Concierge duties are not the same as licensable activity</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Greeting guests, carrying luggage, handing over keys, taking bookings, seating diners and answering questions are
                guest service work. Carrying them out does not, on its own, make a role a licensable security activity.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Guarding a door, controlling access as a security function, patrolling as a security officer, monitoring public space
                cameras or protecting a principal are different activities, and each is matched to its own licence type. If a role
                mixes both, describe both in the requirement so the duties and the licence line up. Check current SIA guidance and
                your own risk assessment for the specific shift.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}