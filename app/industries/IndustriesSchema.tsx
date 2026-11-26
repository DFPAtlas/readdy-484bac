import { FAQS, INDUSTRIES } from './industriesContent';

const SITE = 'https://quickguard.uk';

export default function IndustriesSchema() {
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Industries We Serve | QuickGuard',
    description:
      'Security staffing guides by industry, covering typical roles, role-specific SIA licence requirements, availability checks, posting, applications and payment before confirmation.',
    url: `${SITE}/industries`,
    isPartOf: { '@type': 'WebSite', name: 'QuickGuard', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: INDUSTRIES.length,
      itemListElement: INDUSTRIES.map((industry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: industry.name,
        url: `${SITE}${industry.href}`,
        description: industry.desc,
      })),
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Industries', item: `${SITE}/industries` },
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  );
}