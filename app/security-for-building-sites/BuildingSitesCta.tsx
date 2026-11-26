import Link from 'next/link';

const RELATED = [
  { label: 'Construction security overview', href: '/construction-security' },
  { label: 'How QuickGuard works for clients', href: '/how-it-works/clients' },
  { label: 'Check guard availability', href: '/post-job' },
  { label: 'View client pricing', href: '/pricing' },
];

export default function BuildingSitesCta({ ctaLabel }: { ctaLabel: string }) {
  return (
    <section className="py-24 bg-[#0B1933] relative overflow-hidden" aria-label="Call to action">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
      <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to post a site requirement?</h2>
        <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
          Check recorded availability, sign in to review the guards who apply, then confirm a booking once your card payment succeeds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/client/register"
            prefetch={false}
            className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none cursor-pointer"
          >
            {ctaLabel}
          </Link>
          <Link
            href="/find-a-guard"
            prefetch={false}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur cursor-pointer"
          >
            Browse Available Guards
          </Link>
        </div>
        <nav aria-label="Related pages" className="mt-12">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 list-none m-0 p-0">
            {RELATED.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  className="text-sm text-slate-400 hover:text-teal-300 transition-colors cursor-pointer"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}