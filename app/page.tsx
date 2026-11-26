import type { Metadata } from 'next';
import HomepageHero from './HomepageHero';
import HomepageClient from './HomepageClient';
import HomepageSchema from './HomepageSchema';
import VenueTypeCards from '@/components/VenueTypeCards';
import TrustStrip from '@/components/TrustStrip';
import WhyChooseQuickGuard from '@/components/WhyChooseQuickGuard';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import AuthRedirectCatcher from '@/components/AuthRedirectCatcher';
import { BRAND_LOGO } from '@/lib/brand';

const HOMEPAGE_TITLE = 'Hire SIA-Licensed Security Guards by the Shift | QuickGuard UK';
const HOMEPAGE_DESCRIPTION =
  'Post security work and connect with SIA-licensed guards, subject to availability. Card payment is confirmed through Stripe before the shift, then completion approval and eligibility checks apply before release to the guard’s connected Stripe account. Bank payout is separate.';

export const metadata: Metadata = {
  title: { absolute: HOMEPAGE_TITLE },
  description: HOMEPAGE_DESCRIPTION,
  alternates: {
    canonical: 'https://quickguard.uk',
  },
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    url: 'https://quickguard.uk',
    siteName: 'QuickGuard',
    type: 'website',
    locale: 'en_GB',
    images: [
      {
        url: BRAND_LOGO.social,
        width: 1200,
        height: 630,
        alt: 'QuickGuard - Hire SIA Licensed Security Guards by the Shift',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOMEPAGE_TITLE,
    description:
      'Post security work and connect with SIA-licensed guards, subject to availability. Card payment is confirmed through Stripe before the shift, with completion approval and checks before release.',
    images: [BRAND_LOGO.social],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B1933] page-fade-in">
      <AuthRedirectCatcher />
      <HomepageSchema />
      <NavSidebar />
      <HomepageHero />
      <VenueTypeCards />
      <TrustStrip />
      <HomepageClient />
      <WhyChooseQuickGuard />
      <Footer />
      <style>{`
        @keyframes pageFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .page-fade-in {
          animation: pageFadeIn 0.4s ease-out forwards;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out;
        }

        .counter {
          transition: all 0.3s ease;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}