import { SITE_URL } from '@/lib/seo-helpers';

export default function AccessibilitySchema() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Accessibility Statement | QuickGuard UK',
    url: `${SITE_URL}/accessibility`,
    description:
      'QuickGuard is committed to digital accessibility. Learn about our WCAG 2.1 AA compliance, assistive technology support, and accessibility features.',
    publisher: {
      '@type': 'Organization',
      name: 'QuickGuard',
      url: SITE_URL,
    },
    about: {
      '@type': 'Thing',
      name: 'Digital Accessibility',
      description: 'WCAG 2.1 AA compliant website with screen reader support, keyboard navigation, and assistive technology compatibility.',
    },
  };

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
        name: 'Accessibility Statement',
        item: `${SITE_URL}/accessibility`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}