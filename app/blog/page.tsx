import type { Metadata } from 'next';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import BlogHero from './BlogHero';
import BlogGrid from './BlogGrid';
import NewsletterSignup from './NewsletterSignup';

export const metadata: Metadata = {
  title: 'Security Insights Blog',
  description:
    'Practical guides for UK businesses booking security and for SIA-licensed guards building a career. Industry insight from the QuickGuard team.',
  keywords:
    'security industry blog UK, SIA licence advice, hire security guards guide, door supervisor career, event security planning',
  alternates: {
    canonical: 'https://quickguard.uk/blog',
  },
  openGraph: {
    title: 'Security Insights Blog | QuickGuard',
    description:
      'Practical guides for UK businesses booking security and for SIA-licensed guards building a career.',
    url: 'https://quickguard.uk/blog',
    siteName: 'QuickGuard',
    type: 'website',
    locale: 'en_GB',
  },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      <main>
        <BlogHero />
        <section className="py-16 sm:py-20 bg-[#0B1933]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <BlogGrid />
          </div>
        </section>
        <NewsletterSignup />
      </main>
      <Footer />
    </div>
  );
}