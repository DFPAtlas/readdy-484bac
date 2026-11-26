import type { Metadata } from 'next';
import HowItWorksClient from './HowItWorksClient';
import HowItWorksSchema from './HowItWorksSchema';

export const metadata: Metadata = {
  title: 'How QuickGuard Works',
  description:
    'See how QuickGuard works: check guard availability as a guest, sign in or register, post a job within your plan allowance, review guard responses, pay through Stripe, complete the shift and release guard pay. UK-wide coverage.',
  keywords:
    'how to hire security guards UK, security guard booking process, SIA verification, UK security staffing process, QuickGuard how it works',
  alternates: {
    canonical: 'https://quickguard.uk/how-it-works',
  },
  openGraph: {
    title: 'How It Works | QuickGuard',
    description: 'The full booking and payment journey: availability check, posting within your plan allowance, Stripe payment, shift completion and guard payout.',
    url: 'https://quickguard.uk/how-it-works',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=AI-powered%20security%20guard%20matching%20process%20infographic%20concept%2C%20digital%20connection%20nodes%20linking%20a%20professional%20SIA%20licensed%20security%20guard%20silhouette%20to%20a%20UK%20business%20client%2C%20glowing%20blue%20tech%20lines%20on%20a%20deep%20navy%20gradient%20background%2C%20step%20by%20step%20icons%2C%20modern%20fintech%20aesthetic%2C%20clean%20minimalist%20style%2C%20no%20text%20in%20image&width=1200&height=630&seq=og-hiw-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'How QuickGuard Works — Security Guard Booking and Payment Journey',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works | QuickGuard',
    description: 'The full booking and payment journey: availability check, posting within your plan allowance, Stripe payment, shift completion and guard payout.',
    images: ['https://readdy.ai/api/search-image?query=AI-powered%20security%20guard%20matching%20process%20infographic%20concept%2C%20digital%20connection%20nodes%20linking%20a%20professional%20SIA%20licensed%20security%20guard%20silhouette%20to%20a%20UK%20business%20client%2C%20glowing%20blue%20tech%20lines%20on%20a%20deep%20navy%20gradient%20background%2C%20step%20by%20step%20icons%2C%20modern%20fintech%20aesthetic%2C%20clean%20minimalist%20style%2C%20no%20text%20in%20image&width=1200&height=630&seq=og-hiw-001&orientation=landscape'],
  },
};

export default function HowItWorksPage() {
  return (
    <>
      <HowItWorksSchema />
      <HowItWorksClient />
    </>
  );
}
