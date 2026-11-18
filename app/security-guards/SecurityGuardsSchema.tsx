import { SITE_URL } from '@/lib/seo-helpers';

export default function SecurityGuardsSchema() {
  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Hire SIA Licensed Security Guards Across the UK | QuickGuard',
    url: `${SITE_URL}/security-guards`,
    description:
      'Book verified SIA-licensed security guards in London, Manchester, Birmingham, Leeds, Liverpool, Glasgow, Edinburgh, Bristol, and Cardiff. Instant matching, same-day deployment.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'QuickGuard',
      url: SITE_URL,
    },
    about: {
      '@type': 'Thing',
      name: 'UK Security Guard Services',
      description: ' Nationwide coverage of SIA-licensed security professionals for events, retail, corporate, construction, and residential security.',
    },
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'London Security Guards',
        url: `${SITE_URL}/security-guards/london`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Manchester Security Guards',
        url: `${SITE_URL}/security-guards/manchester`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Birmingham Security Guards',
        url: `${SITE_URL}/security-guards/birmingham`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Leeds Security Guards',
        url: `${SITE_URL}/security-guards/leeds`,
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: 'Liverpool Security Guards',
        url: `${SITE_URL}/security-guards/liverpool`,
      },
      {
        '@type': 'ListItem',
        position: 6,
        name: 'Glasgow Security Guards',
        url: `${SITE_URL}/security-guards/glasgow`,
      },
      {
        '@type': 'ListItem',
        position: 7,
        name: 'Edinburgh Security Guards',
        url: `${SITE_URL}/security-guards/edinburgh`,
      },
      {
        '@type': 'ListItem',
        position: 8,
        name: 'Bristol Security Guards',
        url: `${SITE_URL}/security-guards/bristol`,
      },
      {
        '@type': 'ListItem',
        position: 9,
        name: 'Cardiff Security Guards',
        url: `${SITE_URL}/security-guards/cardiff`,
      },
    ],
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
        name: 'Security Guards UK',
        item: `${SITE_URL}/security-guards`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}