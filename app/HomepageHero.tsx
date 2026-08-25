import Link from 'next/link';

const venueIcons = [
  { icon: 'ri-door-open-line', label: 'Nightclubs' },
  { icon: 'ri-store-2-line', label: 'Retail' },
  { icon: 'ri-hammer-line', label: 'Construction' },
  { icon: 'ri-calendar-event-line', label: 'Events' },
  { icon: 'ri-group-line', label: 'Festivals' },
  { icon: 'ri-archive-line', label: 'Warehouses' },
  { icon: 'ri-building-2-line', label: 'Offices' },
];

export default function HomepageHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative min-h-[720px] md:min-h-screen flex items-center bg-cover bg-center bg-no-repeat pt-20"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.82) 45%, rgba(11, 26, 51, 0.35) 100%), url('https://readdy.ai/api/search-image?query=Professional%20male%20security%20guard%20in%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%20standing%20confidently%20beside%20a%20sleek%20modern%20laptop%20displaying%20a%20dashboard%20interface%20with%20job%20match%20listings%20in%20a%20modern%20urban%20London%20night%20setting%20with%20subtle%20city%20lights%20and%20blurred%20skyline%20background%2C%20high-end%20cinematic%20lighting%20with%20sharp%20realistic%20details%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20features%20a%20clean%20dark%20gradient%20background%20perfect%20for%20text%20overlay%2C%20right%20side%20shows%20the%20guard%20and%20technology%20scene%2C%20ultra%20clean%20premium%20corporate%20composition%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20excellent%20contrast%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20professional%20studio-quality%20lighting%20with%20soft%20shadows%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_quickguard_main_20260503&orientation=landscape')`,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
        <div className="flex items-center gap-2 mb-6 pt-4">
          <img
            src="https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp"
            alt="QuickGuard"
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg object-contain"
          />
          <span className="text-xl font-bold text-white font-[family-name:var(--font-pacifico)]">QuickGuard</span>
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
              { icon: 'ri-checkbox-circle-fill', text: 'No subscriptions required' },
              { icon: 'ri-checkbox-circle-fill', text: 'Pay per shift' },
            ].map((badge) => (
              <span key={badge.text} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-teal-300 text-sm px-3 py-1.5 rounded-full">
                <i className={badge.icon} />
                {badge.text}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Link
              href="/client/register"
              prefetch={false}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none text-center"
            >
              <i className="ri-user-add-line mr-2"></i>
              I Need a Guard
            </Link>
            <Link
              href="/client/register"
              prefetch={false}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm text-center"
            >
              <i className="ri-building-2-line mr-2"></i>
              I&apos;m a Security Company
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-10">
            {venueIcons.map((v) => (
              <Link
                key={v.label}
                href="/client/register"
                prefetch={false}
                className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors text-sm"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`${v.icon} text-teal-400 text-sm`}></i>
                </div>
                {v.label}
              </Link>
            ))}
          </div>

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