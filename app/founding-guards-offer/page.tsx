import type { Metadata } from 'next';
import FoundingGuardsOfferClient from './FoundingGuardsOfferClient';

export const metadata: Metadata = {
  title: 'Founding Guards Offer | Exclusive Security Guard Benefits | QuickGuard UK',
  description:
    'Exclusive founding guard offer for early QuickGuard adopters. Priority job matching, reduced platform fees, premium placement, and lifetime recognition.',
  alternates: {
    canonical: 'https://quickguard.uk/founding-guards-offer',
  },
  openGraph: {
    title: 'Founding Guards Offer | QuickGuard UK',
    description: 'Exclusive founding guard offer with priority matching and reduced fees for early adopters.',
    url: 'https://quickguard.uk/founding-guards-offer',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function FoundingGuardsOfferPage() {
  const offerSchema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: 'Founding Guards Offer',
    description: 'Exclusive founding guard benefits for early QuickGuard adopters including priority job matching and reduced platform fees.',
    url: 'https://quickguard.uk/founding-guards-offer',
    eligibleCustomerType: 'Security Guards',
    areaServed: {
      '@type': 'Country',
      name: 'United Kingdom',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quickguard.uk' },
      { '@type': 'ListItem', position: 2, name: 'Founding Guards Offer', item: 'https://quickguard.uk/founding-guards-offer' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <FoundingGuardsOfferClient />
    </>
  );
}