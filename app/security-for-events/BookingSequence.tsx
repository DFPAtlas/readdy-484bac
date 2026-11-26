import type { BookingStep } from './securityForEventsContent';

interface Props {
  title: string;
  intro: string;
  steps: BookingStep[];
}

export default function BookingSequence({ title, intro, steps }: Props) {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="events-booking-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-list-check-2" aria-hidden="true" />
            How Booking Works
          </div>
          <h2 id="events-booking-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-slate-400">{intro}</p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {steps.map((step, index) => (
            <li key={step.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-4">
                <span className="text-lg font-bold text-teal-400">{index + 1}</span>
              </div>
              <div className="w-8 h-8 flex items-center justify-center mb-3">
                <i className={`${step.icon} text-xl text-teal-400`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm leading-snug">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-slate-500 text-center max-w-3xl mx-auto leading-relaxed">
          The availability check is the only step open to guests. Everything after it requires a signed-in client
          account, because a posting has to be reviewed and confirmed before any guard is notified.
        </p>
      </div>
    </section>
  );
}