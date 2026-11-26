import Link from 'next/link';
import { BOOKING_STEPS } from './industriesContent';

export default function HowBookingWorks() {
  return (
    <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="booking-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-route-line" aria-hidden="true" />
            How booking works
          </div>
          <h2 id="booking-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Availability check, posting, applications, then payment
          </h2>
          <p className="text-lg text-slate-400">
            The same sequence applies in every industry. Requesting a shift does not book it, and selecting a guard does not confirm it.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
          {BOOKING_STEPS.map((step, index) => (
            <li key={step.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-lg shrink-0">
                  <span className="text-sm font-bold text-teal-400">{index + 1}</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <i className={`${step.icon} text-lg text-teal-400`} aria-hidden="true" />
                </div>
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm leading-snug">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#111d35] border border-amber-400/25 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 border border-amber-400/25 rounded-xl shrink-0">
              <i className="ri-information-line text-lg text-amber-300" aria-hidden="true" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              An availability match is a count of guards whose recorded criteria fit your details. It is not a reservation, it does not
              hold anyone, and it is not a guarantee of cover. Response times vary and the shift depends on eligible guards applying
              and on payment completing.
            </p>
          </div>
          <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
            <p className="text-sm font-semibold text-white mb-3">Read the full journey</p>
            <Link
              href="/how-it-works"
              prefetch={false}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
            >
              <i className="ri-arrow-right-line" aria-hidden="true" />
              How QuickGuard works
            </Link>
            <Link
              href="/how-it-works/clients"
              prefetch={false}
              className="mt-3 flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
            >
              <i className="ri-arrow-right-line" aria-hidden="true" />
              Client booking detail
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}