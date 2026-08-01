import type { Metadata } from 'next';
import HowItWorksClient from './HowItWorksClient';
import HowItWorksSchema from './HowItWorksSchema';

export const metadata: Metadata = {
  title: 'How to Hire Security Guards UK | QuickGuard in 5 Steps',
  description:
    'Learn how to hire SIA-licensed security guards in 5 simple steps. Post your job, get matched with verified guards, and pay securely. UK-wide coverage.',
  keywords:
    'how to hire security guards UK, security guard matching, SIA verification, UK security staffing process, QuickGuard how it works',
  alternates: {
    canonical: 'https://quickguard.uk/how-it-works',
  },
  openGraph: {
    title: 'How It Works | QuickGuard',
    description: 'Hire SIA-licensed security guards in 5 easy steps. AI-powered matching and secure UK payments.',
    url: 'https://quickguard.uk/how-it-works',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=AI-powered%20security%20guard%20matching%20process%20infographic%20concept%2C%20digital%20connection%20nodes%20linking%20a%20professional%20SIA%20licensed%20security%20guard%20silhouette%20to%20a%20UK%20business%20client%2C%20glowing%20blue%20tech%20lines%20on%20a%20deep%20navy%20gradient%20background%2C%20step%20by%20step%20icons%2C%20modern%20fintech%20aesthetic%2C%20clean%20minimalist%20style%2C%20no%20text%20in%20image&width=1200&height=630&seq=og-hiw-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'How QuickGuard Works — AI-Powered Security Guard Matching in 5 Steps',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works | QuickGuard',
    description: 'Hire SIA-licensed security guards in 5 easy steps. AI-powered matching and secure UK payments.',
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
