import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-helpers';

export const metadata: Metadata = {
  title: 'Cookie Policy | QuickGuard UK',
  description:
    'Learn how QuickGuard uses cookies. Read about essential, functional, analytics, and marketing cookies. Manage your cookie preferences at any time.',
  alternates: {
    canonical: `${SITE_URL}/cookie-policy`,
  },
};

export default function CookiePolicyLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Cookie Policy', item: `${SITE_URL}/cookie-policy` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}