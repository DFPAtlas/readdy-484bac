import type { Metadata } from 'next';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import IndustriesHero from './IndustriesHero';
import IndustriesGrid from './IndustriesGrid';
import HowBookingWorks from './HowBookingWorks';
import CostModel from './CostModel';
import SiaLicenceGuide from './SiaLicenceGuide';
import IndustriesFaq from './IndustriesFaq';
import IndustriesCta from './IndustriesCta';
import IndustriesSchema from './IndustriesSchema';

export const metadata: Metadata = {
  title: 'Security Staffing by Industry | QuickGuard',
  description:
    'Industry guides for security staffing: typical roles, role-specific SIA licence requirements, guest availability checks, job posting, guard applications and Stripe payment before a booking is confirmed.',
  keywords:
    'security staffing by industry, SIA licence by role, event security roles, door supervisor licence, construction site security, hotel security, retail security, security company manpower',
  alternates: {
    canonical: 'https://quickguard.uk/industries',
  },
  openGraph: {
    title: 'Security Staffing by Industry | QuickGuard',
    description:
      'Roles, role-specific SIA licence requirements and how availability checks, applications and payment-confirmed bookings work in each sector.',
    url: 'https://quickguard.uk/industries',
    siteName: 'QuickGuard',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security Staffing by Industry | QuickGuard',
    description:
      'Roles, role-specific SIA licence requirements and how availability checks, applications and payment-confirmed bookings work in each sector.',
  },
};

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <IndustriesSchema />
      <NavSidebar />

      <IndustriesHero>
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-slate-400 list-none m-0 p-0">
              <li>
                <Link href="/" prefetch={false} className="hover:text-teal-400 transition-colors">
                  Home
                </Link>
              </li>
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
            <p className="text-lg md:text-xl mb-5 text-slate-300 max-w-xl leading-relaxed">
              QuickGuard connects UK organisations with security professionals who choose to apply for their shifts. Each industry
              guide explains the roles usually requested and the licence those duties need — not every role is licensable.
            </p>
            <p className="text-base mb-9 text-slate-400 max-w-xl leading-relaxed">
              Guard registration, job browsing and applications are free. Clients post within a plan allowance and pay a booking
              service fee on top of the agreed guard pay, with the booking confirmed once the Stripe payment succeeds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/client/register?redirect=/post-job"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
              >
                <i className="ri-user-search-line" aria-hidden="true" />
                Find Security Staff
              </Link>
              <Link
                href="/how-it-works"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap backdrop-blur-sm"
              >
                <i className="ri-route-line" aria-hidden="true" />
                How booking works
              </Link>
            </div>
          </div>
        </div>
      </IndustriesHero>

      <IndustriesGrid />
      <HowBookingWorks />
      <CostModel />
      <SiaLicenceGuide />
      <IndustriesFaq />
      <IndustriesCta />

      <Footer />
    </div>
  );
}