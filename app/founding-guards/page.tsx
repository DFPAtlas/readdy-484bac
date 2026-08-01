import type { Metadata } from 'next';
import FoundingGuardsWall from './FoundingGuardsWall';

export const metadata: Metadata = {
  title: 'Founding Guards | QuickGuard UK',
  description:
    'Meet the founding SIA-licensed security guards who joined QuickGuard first. See their profiles, achievements, and contributions to our growing UK security community.',
  alternates: {
    canonical: 'https://quickguard.uk/founding-guards',
  },
  openGraph: {
    title: 'Founding Guards | QuickGuard UK',
    description: 'Meet the founding SIA-licensed security guards who joined QuickGuard first and helped build our community.',
    url: 'https://quickguard.uk/founding-guards',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function FoundingGuardsPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quickguard.uk' },
      { '@type': 'ListItem', position: 2, name: 'Founding Guards', item: 'https://quickguard.uk/founding-guards' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <FoundingGuardsWall />
    </>
  );
}