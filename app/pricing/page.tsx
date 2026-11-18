import type { Metadata } from 'next';
import PricingClient from './PricingClient';
import PricingSchema from './PricingSchema';

export const metadata: Metadata = {
  title: 'Security Guard Hire Pricing | Subscription Plans UK',
  description:
    'Compare free accounts and paid subscriptions for UK clients and SIA-licensed guards. Client plans £49–£199/month; guard memberships £10–£29/month. Booking fees shown separately.',
  keywords:
    'QuickGuard pricing, security guard subscription UK, SIA guard plans, event security pricing, security staffing cost, guard membership',
  alternates: {
    canonical: 'https://quickguard.uk/pricing',
  },
  openGraph: {
    title: 'Pricing Plans | QuickGuard',
    description:
      'Compare free accounts, client subscriptions and guard memberships. See monthly and annual pricing, booking service fees and cancellation terms.',
    url: 'https://quickguard.uk/pricing',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=professional%20pricing%20plans%20comparison%20for%20security%20guard%20staffing%20platform%2C%20clean%20modern%20UK%20corporate%20office%20background%2C%20shield%20icon%20with%20checkmarks%2C%20tiered%20subscription%20cards%20displayed%20on%20a%20sleek%20dashboard%2C%20navy%20blue%20and%20teal%20color%20scheme%2C%20premium%20flat%20design%2C%20no%20people%2C%20minimalist%20and%20professional&width=1200&height=630&seq=og-pricing-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard pricing plans for clients and security guards',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing Plans | QuickGuard',
    description: 'Free accounts, client subscriptions and guard memberships, with monthly and annual billing. Booking service fees are separate.',
    images: ['https://readdy.ai/api/search-image?query=professional%20pricing%20plans%20comparison%20for%20security%20guard%20staffing%20platform%2C%20clean%20modern%20UK%20corporate%20office%20background%2C%20shield%20icon%20with%20checkmarks%2C%20tiered%20subscription%20cards%20displayed%20on%20a%20sleek%20dashboard%2C%20navy%20blue%20and%20teal%20color%20scheme%2C%20premium%20flat%20design%2C%20no%20people%2C%20minimalist%20and%20professional&width=1200&height=630&seq=og-pricing-001&orientation=landscape'],
  },
};

export default function PricingPage() {
  return (
    <>
      <PricingSchema />
      <PricingClient />
    </>
  );
}
