import { SITE_URL } from '@/lib/seo-helpers';

export default function ClientGuideSchema() {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Hire Security Guards on QuickGuard',
    description:
      'Step-by-step guide for UK businesses to hire verified SIA-licensed security guards. Learn to post jobs, review guard profiles, and process secure payments.',
    url: `${SITE_URL}/guide/client`,
    totalTime: 'PT30M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'GBP',
      value: '0',
    },
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Create Your Account',
        text: 'Sign up as a client in minutes and complete your company profile with business details, contact information, and address.',
        url: `${SITE_URL}/guide/client#step-01`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Post a Job',
        text: 'Create a detailed job listing with security type, dates, hours, SIA requirements, venue details, and hourly rate.',
        url: `${SITE_URL}/guide/client#step-02`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Review and Select Guards',
        text: 'Browse applicant profiles with verified SIA licences, ratings, experience, and location to choose the best match.',
        url: `${SITE_URL}/guide/client#step-03`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Secure Payment',
        text: 'Pay guards safely through Stripe after job completion. Full transaction history and automatic receipts provided.',
        url: `${SITE_URL}/guide/client#step-04`,
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
        name: 'Client Guide',
        item: `${SITE_URL}/guide/client`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}