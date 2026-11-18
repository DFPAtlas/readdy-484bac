import type { Metadata } from 'next';
import MobileAppShowcase from './MobileAppShowcase';

export const metadata: Metadata = {
  title: 'QuickGuard Mobile App | Security Guard Booking On The Go | UK',
  description:
    'Preview proposed QuickGuard mobile interfaces for guards, supervisors and area managers. This design preview is not a downloadable iOS or Android application.',
  keywords:
    'QuickGuard mobile app, security guard app UK, hire security app, security staffing app, guard booking app',
  alternates: {
    canonical: 'https://quickguard.uk/mobile-app',
  },
  openGraph: {
    title: 'QuickGuard Mobile App | UK Security Guard Booking',
    description: 'Explore the QuickGuard mobile design preview. Proposed interfaces are shown for review; this is not an app-store download.',
    url: 'https://quickguard.uk/mobile-app',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function MobileAppPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quickguard.uk' },
      { '@type': 'ListItem', position: 2, name: 'Mobile App', item: 'https://quickguard.uk/mobile-app' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MobileAppShowcase />
    </>
  );
}
