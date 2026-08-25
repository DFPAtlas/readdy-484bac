import type { Metadata } from 'next';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import SecurityGuardsSchema from './SecurityGuardsSchema';

interface CityCard {
  slug: string;
  city: string;
  region: string;
  guards: string;
  description: string;
}

const cities: CityCard[] = [
  {
    slug: 'london',
    city: 'London',
    region: 'Greater London & Home Counties',
    guards: '850+',
    description: 'Verified guards across all 32 boroughs including Westminster, Canary Wharf, and the City of London.',
  },
  {
    slug: 'manchester',
    city: 'Manchester',
    region: 'Greater Manchester & North West',
    guards: '420+',
    description: 'Coverage across the city centre, Salford Quays, Trafford Park, and all ten boroughs.',
  },
  {
    slug: 'birmingham',
    city: 'Birmingham',
    region: 'West Midlands & Birmingham Area',
    guards: '380+',
    description: 'From the Bullring to the NEC, serving Birmingham, Solihull, Coventry, and Wolverhampton.',
  },
  {
    slug: 'leeds',
    city: 'Leeds',
    region: 'West Yorkshire & Leeds Area',
    guards: '290+',
    description: 'Security professionals across the city centre, Headingley, Chapel Allerton, and West Yorkshire.',
  },
  {
    slug: 'liverpool',
    city: 'Liverpool',
    region: 'Merseyside & Liverpool Area',
    guards: '260+',
    description: 'Guards covering the city centre, Anfield, Albert Dock, and the full Wirral peninsula.',
  },
  {
    slug: 'glasgow',
    city: 'Glasgow',
    region: 'Scotland & Glasgow Area',
    guards: '240+',
    description: 'From the SEC to Buchanan Galleries, covering the city centre, West End, and Greater Glasgow.',
  },
  {
    slug: 'edinburgh',
    city: 'Edinburgh',
    region: 'Scotland & Edinburgh Area',
    guards: '210+',
    description: 'Festival security, retail guarding, and corporate coverage across the Lothians.',
  },
  {
    slug: 'bristol',
    city: 'Bristol',
    region: 'South West England & Bristol Area',
    guards: '230+',
    description: 'Serving Bristol, Bath, and the South West from Cabot Circus to Ashton Gate.',
  },
  {
    slug: 'cardiff',
    city: 'Cardiff',
    region: 'Wales & Cardiff Area',
    guards: '180+',
    description: 'Principality Stadium events, St David\'s retail security, and coverage across South Wales.',
  },
];

export const metadata: Metadata = {
  title: 'Hire SIA Licensed Security Guards Across the UK | QuickGuard',
  description:
    'Book verified SIA-licensed security guards in London, Manchester, Birmingham, Leeds, Liverpool, Glasgow, Edinburgh, Bristol, and Cardiff. Instant matching, same-day deployment, no upfront fees.',
  keywords:
    'security guards UK, SIA licensed guards, hire security London, security guards Manchester, security guards Birmingham, event security UK, door supervisors UK',
  alternates: {
    canonical: 'https://quickguard.uk/security-guards',
  },
  openGraph: {
    title: 'Hire SIA Licensed Security Guards Across the UK | QuickGuard',
    description:
      'Book verified SIA-licensed security guards in every major UK city. Instant matching, same-day deployment.',
    url: 'https://quickguard.uk/security-guards',
    siteName: 'QuickGuard',
    type: 'website',
    locale: 'en_GB',
    images: [
      {
        url: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
        width: 512,
        height: 512,
        alt: 'QuickGuard - Hire SIA Licensed Security Guards Across the UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hire SIA Licensed Security Guards Across the UK | QuickGuard',
    description: 'Book verified SIA-licensed security guards in every major UK city.',
    images: ['https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp'],
  },
};

export default function SecurityGuardsIndex() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <SecurityGuardsSchema />
      <NavSidebar />

      <section
        className="relative min-h-[480px] md:min-h-[560px] flex items-center bg-cover bg-center bg-no-repeat pt-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.82) 45%, rgba(11, 26, 51, 0.35) 100%), url('https://readdy.ai/api/search-image?query=Professional%20team%20of%20security%20guards%20in%20formal%20black%20uniforms%20standing%20confidently%20in%20a%20modern%20British%20city%20environment%20with%20iconic%20UK%20architecture%20silhouettes%20and%20subtle%20city%20lights%20in%20the%20background%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20team%20and%20British%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subjects&width=1600&height=900&seq=hero_uk_security_index_20260503&orientation=landscape')`,
        }}
      >
        <img
          src="https://readdy.ai/api/search-image?query=Professional%20team%20of%20security%20guards%20in%20formal%20black%20uniforms%20standing%20confidently%20in%20a%20modern%20British%20city%20environment%20with%20iconic%20UK%20architecture%20silhouettes%20and%20subtle%20city%20lights%20in%20the%20background%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20team%20and%20British%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subjects&width=1600&height=900&seq=hero_uk_security_index_20260503&orientation=landscape"
          alt="Professional SIA-licensed security guards across the UK"
          className="sr-only"
        />
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              <i className="ri-map-pin-line" aria-hidden="true"></i>
              Nationwide Coverage
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
              SIA Licensed Security Guards
              <span className="block text-teal-400 mt-1">Across the UK</span>
            </h1>
            <p className="text-lg md:text-xl mb-8 text-slate-300 max-w-xl leading-relaxed">
              QuickGuard operates in every major UK city. Book verified, background-checked security professionals in minutes with same-day deployment available nationwide.
            </p>
            <div className="flex flex-wrap items-center gap-6 text-slate-300 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                  <i className="ri-shield-check-line text-teal-400 text-base" aria-hidden="true"></i>
                </div>
                <span className="font-medium text-slate-200">SIA Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/15">
                  <i className="ri-time-line text-teal-400 text-base" aria-hidden="true"></i>
                </div>
                <span className="font-medium text-slate-200">Same-Day Deployment</span>
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

      <section className="py-20 bg-[#0B1933]" aria-labelledby="cities-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-map-pin-line" aria-hidden="true"></i>
              UK Coverage
            </div>
            <h2 id="cities-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Security Guards in Major UK Cities
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Choose your city to view local security services, coverage areas, pricing, and verified guard availability.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/security-guards/${city.slug}`}
                className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/40 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
                      <i className="ri-building-line text-xl text-teal-400" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{city.city}</h3>
                      <p className="text-xs text-slate-400">{city.region}</p>
                    </div>
                  </div>
                  <i className="ri-arrow-right-line text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true"></i>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mb-5 flex-1">
                  {city.description}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-teal-400 font-semibold">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-shield-user-line" aria-hidden="true"></i>
                    </div>
                    {city.guards} Verified Guards
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-teal-400 transition-colors">
                    View City Page
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628] border-y border-slate-800/60" aria-labelledby="services-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-shield-star-line" aria-hidden="true"></i>
              Services
            </div>
            <h2 id="services-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Security Services Available in Every City
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Whatever your security needs, QuickGuard has verified professionals ready to work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: 'ri-building-line',
                title: 'Corporate Security',
                text: 'Office buildings, co-working spaces, and corporate headquarters.',
              },
              {
                icon: 'ri-shopping-bag-line',
                title: 'Retail Security',
                text: 'Shopping centres, high street stores, and loss prevention.',
              },
              {
                icon: 'ri-calendar-event-line',
                title: 'Event Security',
                text: 'Stadiums, conferences, festivals, and private functions.',
              },
              {
                icon: 'ri-hammer-line',
                title: 'Construction Site Security',
                text: 'Manned guarding, patrols, and access control for building sites.',
              },
              {
                icon: 'ri-hotel-line',
                title: 'Hospitality Security',
                text: 'Hotels, bars, restaurants, and nightclub door supervision.',
              },
              {
                icon: 'ri-home-gear-line',
                title: 'Residential Security',
                text: 'Concierge, patrol, and access control for apartment complexes.',
              },
            ].map((service) => (
              <div
                key={service.title}
                className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/30 transition-all"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-5">
                  <i className={`${service.icon} text-xl text-teal-400`} aria-hidden="true"></i>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{service.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{service.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#0B1933] relative overflow-hidden" aria-labelledby="cta-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line" aria-hidden="true"></i>
            Get Started Today
          </div>
          <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Need Security Guards in Your City?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Post a job in under two minutes and get matched with verified SIA-licensed guards near you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/client/register"
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none"
            >
              Book a Guard Now
            </Link>
            <Link
              href="/guard/register"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm"
            >
              Join as a Guard
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-6">
            No credit card required &middot; Free to get started &middot; Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}