const ROLE_LICENCES = [
  {
    role: 'Door supervision at a function or event bar',
    licence: 'SIA Door Supervisor licence',
    note: 'Where the duty carried out is door supervision activity at licensed premises or an event.',
  },
  {
    role: 'Manned guarding, access control and patrols',
    licence: 'SIA Security Guarding licence',
    note: 'Where the duty is guarding premises, controlling access as a security function or patrolling as an officer.',
  },
  {
    role: 'Public space surveillance cameras',
    licence: 'SIA CCTV (PSS) licence',
    note: 'Where camera work amounts to public space surveillance. General building cameras may fall outside it.',
  },
  {
    role: 'Protecting a principal',
    licence: 'SIA Close Protection licence',
    note: 'Close protection is a separate activity from venue or guest-facing security.',
  },
  {
    role: 'Working with a dog',
    licence: 'the licence for the security activity carried out',
    note: 'The presence of a dog does not by itself decide which licence is needed. Check current SIA guidance for the duty being performed.',
  },
];

const NOT_LICENSABLE = [
  'Reception, concierge and guest service duties',
  'Luggage handling, key handover and seating guests',
  'Queue marshalling and ticket checking at an event',
  'Housekeeping, maintenance and general customer service',
];

export default function HotelLicensingNote() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="hotel-licensing-heading">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 shrink-0">
              <i className="ri-shield-check-line text-2xl text-teal-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="hotel-licensing-heading" className="text-2xl md:text-3xl font-bold text-white mb-4">
                Licences follow the duty, not the venue
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                A hotel can need several different roles on the same night, and each role is matched to the licence that fits the
                activity being carried out. Write the duties into the requirement so the licence asked for follows those duties rather
                than being assumed from the type of building.
              </p>

              <ul className="space-y-3 list-none m-0 p-0 mb-6">
                {ROLE_LICENCES.map((item) => (
                  <li key={item.role} className="flex items-start gap-3 text-sm">
                    <i className="ri-check-line mt-0.5 text-teal-400 shrink-0" aria-hidden="true" />
                    <span className="leading-relaxed text-slate-400">
                      <span className="text-white font-medium">{item.role}</span> — {item.licence}. {item.note}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-slate-700/60 bg-[#0e1628] p-5 mb-6">
                <p className="text-sm font-semibold text-white mb-3">Usually guest service rather than licensable activity</p>
                <ul className="grid sm:grid-cols-2 gap-2.5 list-none m-0 p-0">
                  {NOT_LICENSABLE.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <i className="ri-subtract-line mt-0.5 text-slate-500 shrink-0" aria-hidden="true" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                Licence details are recorded on each guard profile for you to review before you choose. That is information to check,
                not a substitute for your own decision about who works in your venue.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                QuickGuard does not decide whether a particular role needs a licence, and it does not take over conditions attached to a
                premises licence, guest safety arrangements, fire procedures, insurance or first-aid provision. Those stay with the venue
                and its responsible people.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Duties vary by site and by event, so base each requirement on a site-specific risk assessment and check current SIA
                guidance before you post. This page is general information, not legal or licensing advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}