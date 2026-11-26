import Link from 'next/link';
import { CLIENT_FACTS, GUARD_FACTS } from './industriesContent';

export default function CostModel() {
  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="cost-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-money-pound-circle-line" aria-hidden="true" />
            Who pays what
          </div>
          <h2 id="cost-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Free for guards, plan-based for clients
          </h2>
          <p className="text-lg text-slate-400">
            The guard side is free. The client side is a monthly plan plus a booking service fee that sits on top of the agreed guard pay.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl shrink-0">
                <i className="ri-shield-user-line text-xl text-teal-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Security professionals</h3>
                <p className="text-sm text-teal-400">No membership fee</p>
              </div>
            </div>
            <ul className="space-y-3 list-none m-0 p-0 flex-1">
              {GUARD_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <i className="ri-check-line mt-0.5 text-teal-400 shrink-0" aria-hidden="true" />
                  <span className="leading-relaxed">{fact}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/guard/register"
              prefetch={false}
              className="mt-6 inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-semibold transition-all duration-300 whitespace-nowrap"
            >
              <i className="ri-user-add-line" aria-hidden="true" />
              Create a free guard account
            </Link>
          </article>

          <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 flex items-center justify-center bg-blue-500/10 border border-blue-400/20 rounded-xl shrink-0">
                <i className="ri-building-2-line text-xl text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Clients and venues</h3>
                <p className="text-sm text-blue-400">Plan allowance plus a booking fee</p>
              </div>
            </div>
            <ul className="space-y-3 list-none m-0 p-0 flex-1">
              {CLIENT_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <i className="ri-check-line mt-0.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <span className="leading-relaxed">{fact}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              prefetch={false}
              className="mt-6 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-xl font-semibold transition-all duration-300 whitespace-nowrap"
            >
              <i className="ri-table-line" aria-hidden="true" />
              See current plans and fees
            </Link>
          </article>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          {[
            { icon: 'ri-close-circle-line', title: 'No paid guard tiers', desc: 'No membership, job tier or paid priority in discovery or applicant order.' },
            { icon: 'ri-subtract-line', title: 'No guard-side commission', desc: 'The platform booking fee is not deducted from agreed gross pay on new bookings.' },
            { icon: 'ri-file-list-line', title: 'No charge to post', desc: 'Publishing a job does not take the booking payment; that happens at checkout.' },
          ].map((item) => (
            <div key={item.title} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-5">
              <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-lg mb-3">
                <i className={`${item.icon} text-teal-400`} aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-white mb-1.5">{item.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}