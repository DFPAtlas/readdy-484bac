import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-helpers';

export const metadata: Metadata = {
  title: 'Terms of Service | QuickGuard UK',
  description:
    'Read the QuickGuard Terms of Service. Legal terms and conditions for using our UK security guard marketplace platform.',
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Terms of Service',
        item: `${SITE_URL}/terms`,
      },
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