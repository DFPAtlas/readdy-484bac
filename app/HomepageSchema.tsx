import { SITE_URL } from '@/lib/seo-helpers';
import { BRAND_LOGO } from '@/lib/brand';

export default function HomepageSchema() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuickGuard',
    url: SITE_URL,
    logo: BRAND_LOGO.social,
    description:
      'A UK marketplace where businesses and venues can post security work and connect with SIA-licensed guards, subject to guard availability.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}/contact`,
      areaServed: 'GB',
      availableLanguage: 'English',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GB',
    },
    areaServed: {
      '@type': 'Country',
      name: 'United Kingdom',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'QuickGuard',
    url: SITE_URL,
    description:
      'Post security work or find security jobs in the UK, with SIA licence checks and held payments through Stripe.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/jobs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is QuickGuard.uk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'QuickGuard.uk is a UK-based platform where clients post security work and SIA-licensed guards can respond. When a job is posted, guards whose settings match the job location can be notified. Responses depend on guard availability, and cover is confirmed only after a client selects a guard and completes payment.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need an SIA licence to join as a security guard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Yes. Guards on QuickGuard.uk must hold an SIA (Security Industry Authority) licence, and the licence is checked before they can take work through the platform. Licence status can change over time, so clients can review the guard's licence details before confirming a booking.",
        },
      },
      {
        '@type': 'Question',
        name: 'How much does it cost for guards to use the platform?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Guard profiles, job browsing and applications are free, with no monthly application cap or paid job tiers. Account approval, valid SIA licensing and job requirements apply. Paid membership does not determine discovery order.',
        },
      },
      {
        '@type': 'Question',
        name: 'When and how do guards get paid?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Once a client confirms job completion, the agreed amount is released in full, with no commission deducted from guard pay. The funds are transferred to your connected Stripe account, and payment into your bank account is a separate Stripe payout. Bank arrival depends on available funds, your Stripe payout schedule, account verification and bank processing. Payment records are available in your account, and you remain responsible for your own tax reporting.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a cost for clients to post a job?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can post a job for free and there are no setup fees. Payment is required after you select a guard and before the booking is confirmed. The client booking service fee depends on your plan and any promotion applied, and the exact amount is shown before you pay.',
        },
      },
      {
        '@type': 'Question',
        name: 'How quickly can I find a security guard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Posting a job usually takes a few minutes. Guards whose settings match your location can be notified and can respond, but responses depend on their availability. Posting does not guarantee cover; the booking exists only once you select a responding guard and complete payment.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are all guards on the platform verified?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every guard must pass an SIA licence check before being approved to take work on the platform. Clients can review a guard\u2019s profile and licence details before confirming. A licence check reduces risk but is not a guarantee of a guard\u2019s future conduct.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the payment protection work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Clients pay for the shift by card through Stripe, and the funds are held until the client confirms the shift has been completed. The payment is then released to the guard\u2019s connected Stripe account, with no commission deducted from guard pay. If a dispute is raised, release can be paused for review.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who is responsible for tax reporting?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'QuickGuard is a marketplace, not the guard’s employer. Guards and clients are responsible for their own tax, National Insurance, VAT and reporting obligations. Payment records support record-keeping but do not replace independent tax advice.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which areas of the UK does QuickGuard.uk cover?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Jobs can be posted anywhere in the UK, and guards set the areas they are willing to work in. Whether a job receives a response depends on which guards are available near that location, so cover is not guaranteed in every area or at every time.'
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
