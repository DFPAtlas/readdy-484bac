import { SITE_URL } from '@/lib/seo-helpers';

export default function ContactSchema() {
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${SITE_URL}/#business`,
    name: 'QuickGuard',
    alternateName: 'QuickGuard.uk',
    url: SITE_URL,
    logo: 'https://readdy.ai/api/search-image?query=Minimalist%20professional%20security%20company%20logo%20featuring%20the%20letter%20Q%20in%20elegant%20serif%20font%20on%20a%20dark%20navy%20blue%20background%20with%20subtle%20teal%20accent%20glow%20around%20the%20letter%2C%20clean%20corporate%20branding%20style%2C%20no%20shadows%20or%20gradients%20on%20the%20letter%20itself%2C%20flat%20design%20aesthetic%2C%20perfect%20square%20composition%2C%20professional%20logo%20design%20for%20a%20UK%20security%20staffing%20platform%2C%20dark%20background%20with%20the%20white%20and%20teal%20letter%20Q%20centered%2C%20no%20additional%20text%20or%20elements%2C%20pure%20and%20simple%20logo%20mark%2C%20suitable%20for%20favicon%20and%20social%20media%20sharing%2C%20high%20contrast%20and%20crisp%2C%20modern%20minimalist%20brand%20identity&width=512&height=512&seq=quickguard_og_logo_20260503&orientation=squarish',
    image: 'https://readdy.ai/api/search-image?query=Minimalist%20professional%20security%20company%20logo%20featuring%20the%20letter%20Q%20in%20elegant%20serif%20font%20on%20a%20dark%20navy%20blue%20background%20with%20subtle%20teal%20accent%20glow%20around%20the%20letter%2C%20clean%20corporate%20branding%20style%2C%20no%20shadows%20or%20gradients%20on%20the%20letter%20itself%2C%20flat%20design%20aesthetic%2C%20perfect%20square%20composition%2C%20professional%20logo%20design%20for%20a%20UK%20security%20staffing%20platform%2C%20dark%20background%20with%20the%20white%20and%20teal%20letter%20Q%20centered%2C%20no%20additional%20text%20or%20elements%2C%20pure%20and%20simple%20logo%20mark%2C%20suitable%20for%20favicon%20and%20social%20media%20sharing%2C%20high%20contrast%20and%20crisp%2C%20modern%20minimalist%20brand%20identity&width=512&height=512&seq=quickguard_og_logo_20260503&orientation=squarish',
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
    sameAs: [
      // TODO: Replace with real social media URLs when available
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