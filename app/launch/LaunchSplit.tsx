import Link from 'next/link';

const CARDS = [
  {
    badge: 'For clients',
    icon: 'ri-store-2-line',
    accent: 'teal',
    title: 'Cover the festive rush',
    points: [
      'Retail, events and late-night venues',
      'Book vetted guards in minutes',
      'Add cover for peak trading and one-off events',
    ],
    cta: 'I need security',
    href: '/client/register',
    iconCta: 'ri-building-2-line',
  },
  {
    badge: 'For guards',
    icon: 'ri-shield-user-line',
    accent: 'blue',
    title: 'Pick up extra shifts over Christmas',
    points: [
      'Flexible work around your schedule',
      'Quick signup with automatic SIA licence check',
      'See opportunities from UK businesses directly',
    ],
    cta: 'I\u2019m a guard',
    href: '/guard/register',
    iconCta: 'ri-shield-check-line',
  },
];

export default function LaunchSplit() {
  return (
    <section className="py-20 bg-[#0e1628]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {CARDS.map((card) => {
            const isTeal = card.accent === 'teal';
            return (
              <div
                key={card.title}
                className="flex flex-col bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-10 hover:border-slate-600 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`w-12 h-12 flex items-center justify-center rounded-xl border ${
                      isTeal
                        ? 'bg-teal-500/10 border-teal-400/20'
                        : 'bg-blue-500/10 border-blue-400/20'
                    }`}
                  >
                    <i
                      className={`${card.icon} text-xl ${isTeal ? 'text-teal-400' : 'text-blue-400'}`}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap border ${
                      isTeal
                        ? 'text-teal-300 bg-teal-500/10 border-teal-400/20'
                        : 'text-blue-300 bg-blue-500/10 border-blue-400/20'
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-snug">{card.title}</h2>

                <ul className="space-y-3 list-none m-0 p-0 mb-8 flex-1">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
                      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i
                          className={`ri-check-line ${isTeal ? 'text-teal-400' : 'text-blue-400'}`}
                          aria-hidden="true"
                        />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>

                <Link
                  href={card.href}
                  prefetch={false}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                    isTeal
                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-900 shadow-lg hover:shadow-teal-500/20'
                      : 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg hover:shadow-blue-500/20'
                  }`}
                >
                  <i className={card.iconCta} aria-hidden="true" />
                  {card.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}