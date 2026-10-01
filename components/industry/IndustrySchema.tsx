import { SITE_URL } from '@/lib/seo-helpers';

interface Props {
  name: string;
  slug: string;
  description: string;
  services?: string[];
}

export default function IndustrySchema({ name, slug, description, services = [] }: Props) {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'Organization',
      name: 'QuickGuard',
      url: SITE_URL,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United Kingdom',
    },
    serviceType: 'Security Guard Staffing',
    url: `${SITE_URL}/${slug}`,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Industries', item: `${SITE_URL}/industries` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_URL}/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {services.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: services.map((s) => ({
                '@type': 'Question',
                name: s,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `QuickGuard helps businesses find licensed security professionals for ${name.toLowerCase()} requirements.`,
                },
              })),
            }),
          }}
        />
      )}
    </>
  );
}