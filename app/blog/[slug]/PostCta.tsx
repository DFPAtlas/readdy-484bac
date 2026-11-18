import Link from 'next/link';

export default function PostCta() {
  return (
    <section className="mt-14 bg-gradient-to-br from-[#111d35] to-[#0e1628] border border-teal-500/25 rounded-2xl p-7 sm:p-9">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/15 border border-teal-400/25 flex-shrink-0">
          <i className="ri-shield-check-line text-lg text-teal-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-snug">Ready to put this into practice?</h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            QuickGuard connects UK businesses with verified SIA-licensed guards, shift by shift. No agency fees and no long contracts.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link
          href="/client/register?role=client"
          prefetch={false}
          className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-building-2-line text-base" aria-hidden="true" />
          </span>
          I need security
        </Link>
        <Link
          href="/guard/register?role=guard"
          prefetch={false}
          className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-shield-user-line text-base" aria-hidden="true" />
          </span>
          I&rsquo;m a guard
        </Link>
      </div>
    </section>
  );
}