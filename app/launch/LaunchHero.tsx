import Link from 'next/link';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Two%20professional%20SIA%20licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20softly%20lit%20UK%20high%20street%20venue%20at%20dusk%2C%20subtle%20warm%20golden%20fairy%20lights%20and%20a%20light%20dusting%20of%20snow%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20grade%2C%20wide%20cinematic%20composition%20with%20the%20left%20third%20kept%20dark%20and%20clean%20for%20text%20overlay%2C%20premium%20editorial%20photography%2C%20sharp%20realistic%20detail%2C%20calm%20and%20trustworthy%20atmosphere&width=1600&height=900&seq=launch_hero_dec_2026&orientation=landscape';

export default function LaunchHero() {
  return (
    <section
      className="relative w-full min-h-[620px] flex items-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 25, 51, 0.97) 0%, rgba(11, 25, 51, 0.9) 48%, rgba(11, 25, 51, 0.55) 100%), url('${HERO_IMAGE}')`,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-snowflake-line text-teal-300" aria-hidden="true" />
            </span>
            Launching 1 December
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.08] text-white">
            QuickGuard is live — December&rsquo;s on us
          </h1>

          <p className="text-lg md:text-xl mb-4 text-slate-300 leading-relaxed max-w-xl">
            The UK marketplace connecting businesses with vetted, SIA-licensed security guards. No subscription fee for December.
          </p>

          <p className="text-base text-amber-200/90 mb-9 max-w-xl leading-relaxed">
            No subscription fee for December — applied automatically, no code needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
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
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap backdrop-blur-sm"
            >
              <i className="ri-shield-user-line" aria-hidden="true" />
              I&rsquo;m a guard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}