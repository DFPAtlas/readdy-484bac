import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Industries We Serve | Security Staffing',
  description:
    'Explore the industries QuickGuard supports — security companies, pubs, bars and nightclubs, events and festivals, construction, hotels and hospitality, and retail. Find licensed security staff fast.',
  keywords:
    'security staffing industries, SIA security staff UK, event security, construction security, hotel security, retail security',
  alternates: {
    canonical: 'https://quickguard.uk/industries',
  },
  openGraph: {
    title: 'Industries We Serve | QuickGuard Security Staffing',
    description:
      'Security staffing for security companies, venues, events, construction, hospitality and retail across the UK.',
    url: 'https://quickguard.uk/industries',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

const INDUSTRIES = [
  { name: 'Security Companies', href: '/security-companies', icon: 'ri-shield-star-line', desc: 'Fill manpower gaps and backfill shifts when your workforce cannot cover the requirement.', badge: 'Manpower support' },
  { name: 'Pubs, Bars & Nightclubs', href: '/pubs-bars-nightclubs', icon: 'ri-goblet-line', desc: 'Find available SIA Door Supervisors for weekends, events and short-notice venue cover.', badge: 'Door staff cover' },
  { name: 'Events & Festivals', href: '/event-security', icon: 'ri-calendar-event-line', desc: 'Build a multi-role event security team for concerts, festivals and private functions.', badge: 'Event staffing' },
  { name: 'Construction', href: '/construction-security', icon: 'ri-hammer-line', desc: 'Protect sites, plant and materials with licensed site security, day or night.', badge: 'Site security' },
  { name: 'Hotels & Hospitality', href: '/hotel-security', icon: 'ri-hotel-line', desc: 'Discreet security for weddings, conferences, functions and short-notice incidents.', badge: 'Hospitality cover' },
  { name: 'Retail', href: '/retail-security', icon: 'ri-store-2-line', desc: 'Add cover for busy trading periods, peak seasons and unexpected shortages.', badge: 'Retail cover' },
];

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <Header />

      <section
        className="relative min-h-[460px] flex items-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.96) 0%, rgba(11, 26, 51, 0.85) 55%, rgba(11, 26, 51, 0.5) 100%), url('https://readdy.ai/api/search-image?query=Wide%20cinematic%20montage-like%20scene%20of%20professional%20SIA-licensed%20security%20professionals%20in%20smart%20black%20uniforms%20across%20different%20UK%20working%20environments%2C%20a%20venue%20door%2C%20an%20event%20crowd%2C%20a%20construction%20site%20and%20a%20retail%20storefront%20softly%20blended%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20moody%20atmospheric%20lighting%2C%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_hub_hero_20261001&orientation=landscape')`,
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-20">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-slate-400 list-none m-0 p-0">
              <li><Link href="/" prefetch={false} className="hover:text-teal-400 transition-colors">Home</Link></li>
              <li aria-hidden="true" className="text-slate-600">/</li>
              <li className="text-slate-300" aria-current="page">Industries</li>
            </ol>
          </nav>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              <i className="ri-building-4-line" aria-hidden="true" />
              Industries we serve
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
              Security staffing, shaped around your industry.
            </h1>
            <p className="text-lg md:text-xl mb-9 text-slate-300 max-w-xl leading-relaxed">
              QuickGuard helps organisations across the UK find available, licensed security professionals — whether you need one shift covered or a full event team.
            </p>
            <Link
              href="/client/register?redirect=/post-job"
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
            >
              <i className="ri-user-search-line" aria-hidden="true" />
              Find Security Staff
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
            {INDUSTRIES.map((industry) => (
              <li key={industry.href}>
                <Link
                  href={industry.href}
                  prefetch={false}
                  className="group flex flex-col h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 hover:border-teal-500/40 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 group-hover:bg-teal-500/20 transition-all">
                      <i className={`${industry.icon} text-xl text-teal-400`} aria-hidden="true" />
                    </div>
                    <span className="text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-400/20 px-3 py-1 rounded-full whitespace-nowrap">
                      {industry.badge}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-teal-300 transition-colors">
                    {industry.name}
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed flex-1">{industry.desc}</p>
                  <span className="inline-flex items-center gap-2 mt-5 text-sm font-medium text-teal-400">
                    View industry
                    <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-24 bg-[#0e1628] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" aria-hidden="true" />
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Don&rsquo;t see your industry?</h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            QuickGuard supports organisations across the UK. Post your requirement and available licensed professionals can respond.
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
        </div>
      </section>

      <Footer />
    </div>
  );
}