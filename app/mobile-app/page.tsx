import type { Metadata } from 'next';
import MobileAppShowcase from './MobileAppShowcase';

export const metadata: Metadata = {
  title: 'QuickGuard Mobile App | Security Guard Booking On The Go | UK',
  description:
    'Download the QuickGuard mobile app for iOS and Android. Post jobs, find guards, track shifts, and process payments on the go. SIA-verified security staffing in your pocket.',
  keywords:
    'QuickGuard mobile app, security guard app UK, hire security app, security staffing app, guard booking app',
  alternates: {
    canonical: 'https://quickguard.uk/mobile-app',
  },
  openGraph: {
    title: 'QuickGuard Mobile App | UK Security Guard Booking',
    description: 'Download the QuickGuard mobile app. Post jobs, find guards, and process payments on the go.',
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