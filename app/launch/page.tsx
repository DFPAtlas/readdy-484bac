import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LaunchHero from './LaunchHero';
import LaunchBenefits from './LaunchBenefits';
import LaunchSplit from './LaunchSplit';
import LaunchSteps from './LaunchSteps';
import LaunchFaq from './LaunchFaq';
import LaunchCta from './LaunchCta';

export const metadata: Metadata = {
  title: { absolute: 'QuickGuard Launch — December Free' },
  description:
    'QuickGuard launches 1 December. Guard job access is free. Eligible new clients can review the December subscription offer and its renewal terms.',
  alternates: {
    canonical: 'https://quickguard.uk/launch',
  },
  openGraph: {
    title: 'QuickGuard Launch — December Free',
    description:
      'QuickGuard launches 1 December. Guard job access is free. Eligible new clients can review the December subscription offer and its renewal terms.',
    url: 'https://quickguard.uk/launch',
    siteName: 'QuickGuard',
    type: 'website',
    locale: 'en_GB',
  },
};

export default function LaunchPage() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <Header />
      <main>
        <LaunchHero />
        <LaunchBenefits />
        <LaunchSplit />
        <LaunchSteps />
        <LaunchFaq />
        <LaunchCta />
      </main>
      <Footer />
    </div>
  );
}