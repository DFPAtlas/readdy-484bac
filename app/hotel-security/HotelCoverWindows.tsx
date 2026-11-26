const WINDOWS = [
  {
    key: 'planned',
    label: 'Planned cover',
    icon: 'ri-calendar-schedule-line',
    accent: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-400/20',
    items: [
      'A wedding, conference or party night posted in advance',
      'Cover across the festive function season',
      'Nightly presence for a set period or refurbishment',
      'Recurring weekend shifts, checked against the first shift',
    ],
  },
  {
    key: 'shortNotice',
    label: 'Short-notice cover',
    icon: 'ri-timer-line',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    items: [
      'Extra presence after guest numbers rise',
      'Backfill when a booked officer cancels',
      'Cover while you recruit a permanent officer',
      'Additional presence after an incident on site',
    ],
  },
  {
    key: 'extended',
    label: 'Extended cover',
    icon: 'ri-building-4-line',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-400/20',
    items: [
      'Multi-day cover across a programme of events',
      'Recurring weekly nights for a fixed period',
      'Ongoing requirements posted inside your plan allowance',
      'Additional shifts through peak trading periods',
    ],
  },
];

export default function HotelCoverWindows() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="hotel-cover-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-time-line" aria-hidden="true" />
            When cover is needed
          </div>
          <h2 id="hotel-cover-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Planned, short-notice and extended requirements
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Post the window that fits your venue diary. A short-notice requirement is posted and matched in the same way as any other,
            so what comes back depends on which eligible guards apply — we do not promise a night will be filled within a set time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {WINDOWS.map((group) => (
            <div key={group.key} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7">
              <div className={`w-12 h-12 flex items-center justify-center rounded-xl border mb-5 ${group.bg} ${group.border}`}>
                <i className={`${group.icon} text-xl ${group.accent}`} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">{group.label}</h3>
              <ul className="space-y-3 list-none m-0 p-0">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <i className={`ri-check-line mt-0.5 ${group.accent}`} aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}