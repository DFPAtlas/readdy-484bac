import { SITE_URL } from '@/lib/seo-helpers';

interface CitySchemaProps {
  city: string;
  region: string;
  description: string;
  faqs: { question: string; answer: string }[];
}

export default function CityPageSchema({ city, region, description, faqs }: CitySchemaProps) {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Hire SIA Licensed Security Guards in ${city}`,
    description,
    provider: {
      '@type': 'Organization',
      name: 'QuickGuard',
      url: SITE_URL,
    },
    areaServed: {
      '@type': 'City',
      name: city,
      '@id': `https://en.wikipedia.org/wiki/${encodeURIComponent(city)}`,
      containedInPlace: {
        '@type': 'Country',
        name: 'United Kingdom',
      },
    },
    serviceType: 'Security Guard Staffing',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
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
      {
        '@type': 'ListItem',
        position: 3,
        name: `${city} Security Guards`,
        item: `${SITE_URL}/security-guards/${city.toLowerCase()}`,
      },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}