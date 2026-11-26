import Link from 'next/link';

export default function IndustriesCta() {
  return (
    <section className="py-24 bg-[#0e1628] relative overflow-hidden" aria-labelledby="industries-cta-heading">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" aria-hidden="true" />
      <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
        <h2 id="industries-cta-heading" className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Start with your requirement
        </h2>
        <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
          Check availability as a guest, register to post your requirement, and review applicants before you pay to confirm the shift.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/client/register?redirect=/post-job"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
          >
            <i className="ri-user-search-line" aria-hidden="true" />
            Find Security Staff
          </Link>
          <Link
            href="/client/register"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
          >
            <i className="ri-building-2-line" aria-hidden="true" />
            Create Company Account
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Popular next steps</p>
          <ul className="flex flex-wrap items-center justify-center gap-3 list-none m-0 p-0">
            {[
              { label: 'How booking works', href: '/how-it-works' },
              { label: 'Client booking detail', href: '/how-it-works/clients' },
              { label: 'Current plans and fees', href: '/pricing' },
              { label: 'Free guard registration', href: '/guard/register' },
              { label: 'See your own industry guide', href: '/security-guards' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  className="inline-flex items-center gap-2 bg-[#111d35] border border-slate-700/50 hover:border-teal-500/40 hover:text-white text-slate-300 px-4 py-2 rounded-full text-sm font-medium transition-all"
                >
                  <i className="ri-arrow-right-up-line text-teal-400" aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}