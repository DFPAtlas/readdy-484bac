import HomepageHero from './HomepageHero';
import HomepageClient from './HomepageClient';
import HomepageSchema from './HomepageSchema';
import VenueTypeCards from '@/components/VenueTypeCards';
import TrustStrip from '@/components/TrustStrip';
import WhyChooseQuickGuard from '@/components/WhyChooseQuickGuard';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import AuthRedirectCatcher from '@/components/AuthRedirectCatcher';

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