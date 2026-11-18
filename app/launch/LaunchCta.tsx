import Link from 'next/link';

export default function LaunchCta() {
  return (
    <section className="py-24 bg-[#0B1933] relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-slate-900/40 pointer-events-none"
        aria-hidden="true"
      />
      <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-300/25 text-amber-200 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-snowflake-line" aria-hidden="true" />
          </span>
          Launching 1 December
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white leading-tight">
          Be one of the first on QuickGuard
        </h2>
        <p className="text-xl mb-4 text-slate-400 max-w-2xl mx-auto">
          No subscription fee for December — applied automatically, no code needed.
        </p>
        <p className="text-sm text-slate-500 mb-10">Standard subscription applies from 1 January.</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/client/register"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
          >
            <i className="ri-building-2-line" aria-hidden="true" />
            I need security
          </Link>
          <Link
            href="/guard/register"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
          >
            <i className="ri-shield-user-line" aria-hidden="true" />
            I&rsquo;m a guard
          </Link>
        </div>
      </div>
    </section>
  );
}