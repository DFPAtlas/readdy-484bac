import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import HomepageIndustries from './HomepageIndustries';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20male%20security%20guard%20in%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%20standing%20confidently%20beside%20a%20sleek%20modern%20laptop%20displaying%20a%20dashboard%20interface%20with%20job%20match%20listings%20in%20a%20modern%20urban%20London%20night%20setting%20with%20subtle%20city%20lights%20and%20blurred%20skyline%20background%2C%20high-end%20cinematic%20lighting%20with%20sharp%20realistic%20details%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20features%20a%20clean%20dark%20gradient%20background%20perfect%20for%20text%20overlay%2C%20right%20side%20shows%20the%20guard%20and%20technology%20scene%2C%20ultra%20clean%20premium%20corporate%20composition%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20excellent%20contrast%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20professional%20studio-quality%20lighting%20with%20soft%20shadows%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_quickguard_main_20260503&orientation=landscape';

export default function HomepageHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative min-h-[720px] md:min-h-screen flex items-center pt-20 overflow-hidden"
    >
      <img
        src={HERO_IMAGE}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.82) 45%, rgba(11, 26, 51, 0.35) 100%)',
        }}
      />
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 relative z-10">
        <div className="flex items-center mb-6 pt-4">
          <BrandLogo variant="full" theme="dark" imgClassName="h-16 w-auto" />
        </div>

        <div className="max-w-2xl">
          <h1 id="hero-heading" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] text-white">
            Hire SIA-Licensed Guards
            <span className="block text-teal-400 mt-1">Directly. By the Shift.</span>
          </h1>

          <p className="text-lg md:text-xl mb-10 text-slate-300 max-w-xl leading-relaxed">
            No agency fees. No long contracts. Pay-as-you-go security. Book verified SIA guards for your venue, event, or site in under 5 minutes.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            {[
              { icon: 'ri-checkbox-circle-fill', text: 'No contracts' },
              { icon: 'ri-checkbox-circle-fill', text: 'Free plan available' },
              { icon: 'ri-checkbox-circle-fill', text: 'Pay per shift' },
            ].map((badge) => (
              <span key={badge.text} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-teal-300 text-sm px-3 py-1.5 rounded-full">
                <i className={badge.icon} />
                {badge.text}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Link
              href="/post-job?mode=immediate&source=homepage"
              prefetch={false}
              className="bg-red-600 hover:bg-red-500 text-white px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg font-semibold shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-red-500/30 focus:outline-none text-center"
            >
              <i className="ri-flashlight-fill mr-2"></i>
              Book a Guard Now
            </Link>
            <Link
              href="/company/login"
              prefetch={false}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm text-center"
            >
              <i className="ri-building-2-line mr-2"></i>
              I&apos;m a Security Company
            </Link>
          </div>

          <p className="text-slate-200 mb-1.5 max-w-xl">
            Tell us what you need. We&apos;ll notify suitable verified guards immediately.
          </p>
          <p className="flex items-center gap-1.5 text-sm text-emerald-300 mb-6">
            <i className="ri-shield-check-line" aria-hidden="true"></i>
            No card required until you select a guard.
          </p>

          <HomepageIndustries />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-slate-300 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                <i className="ri-shield-star-line text-teal-400 text-base" aria-hidden="true"></i>
              </div>
              <span className="font-medium text-slate-200">SIA Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                <i className="ri-lock-line text-teal-400 text-base" aria-hidden="true"></i>
              </div>
              <span className="font-medium text-slate-200">Held Job Payment with Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                <i className="ri-building-2-line text-teal-400 text-base" aria-hidden="true"></i>
              </div>
              <span className="font-medium text-slate-200">500+ Venues</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                <i className="ri-star-fill text-teal-400 text-base" aria-hidden="true"></i>
              </div>
              <span className="font-medium text-slate-200">4.9/5 Rating</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
