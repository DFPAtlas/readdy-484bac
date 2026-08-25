import { SITE_URL } from '@/lib/seo-helpers';

export default function ContactSchema() {
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${SITE_URL}/#business`,
    name: 'QuickGuard',
    alternateName: 'QuickGuard.uk',
    url: SITE_URL,
    logo: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
    description:
      'QuickGuard is a UK-based marketplace connecting clients with SIA-licensed security guards for emergency cover, events, and ongoing security assignments.',
    telephone: '',
    email: 'info@quickguard.uk',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'London',
      addressCountry: 'GB',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 51.5074,
      longitude: -0.1278,
    },
    areaServed: [
      { '@type': 'Country', name: 'United Kingdom' },
      { '@type': 'City', name: 'London' },
      { '@type': 'City', name: 'Manchester' },
      { '@type': 'City', name: 'Birmingham' },
      { '@type': 'City', name: 'Edinburgh' },
      { '@type': 'City', name: 'Cardiff' },
      { '@type': 'City', name: 'Belfast' },
    ],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday'],
        opens: '10:00',
        closes: '16:00',
      },
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '',
        contactType: 'customer support',
        areaServed: 'GB',
        availableLanguage: 'English',
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '00:00',
          closes: '23:59',
        },
      },
      {
        '@type': 'ContactPoint',
        email: 'guards@quickguard.uk',
        contactType: 'technical support',
        contactOption: 'TollFree',
        areaServed: 'GB',
        availableLanguage: 'English',
      },
      {
        '@type': 'ContactPoint',
        email: 'clients@quickguard.uk',
        contactType: 'sales',
        areaServed: 'GB',
        availableLanguage: 'English',
      },
    ],
    priceRange: '££',
    currenciesAccepted: 'GBP',
    paymentAccepted: 'Credit Card, Debit Card',
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE_URL}/#service`,
    name: 'SIA-Licensed Security Guard Matching',
    serviceType: 'Security Guard Staffing',
    description:
      'AI-powered platform that instantly matches clients with verified, SIA-licensed security guards for emergency cover, events, door supervision, and ongoing security contracts across the UK.',
    provider: {
      '@id': `${SITE_URL}/#business`,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United Kingdom',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Security Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Emergency Security Cover',
            description: 'Same-day SIA-licensed security guard cover for last-minute staffing needs.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Event Security',
            description: 'Qualified security guards for corporate events, venues, and public gatherings.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Door Supervision',
            description: 'SIA-licensed door supervisors for bars, clubs, and licensed premises.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Static Guarding',
            description: 'Reliable security guards for retail, construction sites, and commercial properties.',
          },
        },
      ],
    },
    termsOfService: `${SITE_URL}/terms`,
    url: SITE_URL,
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
        name: 'Contact',
        item: `${SITE_URL}/contact`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}