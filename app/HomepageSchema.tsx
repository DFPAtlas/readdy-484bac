import { SITE_URL } from '@/lib/seo-helpers';

export default function HomepageSchema() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuickGuard',
    url: SITE_URL,
    logo: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
    description:
      "UK's leading marketplace connecting clients with SIA-licensed security guards for emergency cover, events, and ongoing security needs.",
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
      'Find verified SIA-licensed security guards across the UK, or find security jobs near you.',
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
          text: 'QuickGuard.uk is a UK-based platform that connects SIA-licensed security guards with clients who need professional security services. Our AI-powered matching system ensures the right guard is paired with the right job, anywhere across England, Scotland, Wales, and Northern Ireland.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need an SIA licence to join as a security guard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Yes. All security guards on QuickGuard.uk must hold a valid SIA (Security Industry Authority) licence. We verify every guard's licence before they can apply for jobs, ensuring clients always work with fully compliant professionals.",
        },
      },
      {
        '@type': 'Question',
        name: 'How much does it cost for guards to use the platform?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Guards pay a monthly subscription starting from £10/month. There are multiple tiers available depending on the level of visibility and features you need. You can view all plans on our Pricing page.',
        },
      },
      {
        '@type': 'Question',
        name: 'When and how do guards get paid?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Once a client confirms job completion, payment is released to your account minus a 5% platform fee. Funds are transferred directly to your registered UK bank account. You also receive automatic UTR and tax documentation to stay HMRC compliant.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a cost for clients to post a job?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "There are no upfront costs or setup fees for clients. You only pay when a shift is successfully completed. Our transparent commission model means you always know exactly what you're paying for.",
        },
      },
      {
        '@type': 'Question',
        name: 'How quickly can I find a security guard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our AI matching system instantly surfaces the most suitable verified guards for your job. Many clients receive applications within minutes of posting. You can review profiles, check SIA credentials, and confirm a guard — all within the same day.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are all guards on the platform verified?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Every guard undergoes SIA licence verification before being approved on the platform. We check licence validity, specialisations, and compliance status so you can hire with complete confidence.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the payment protection work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Clients pre-pay for the shift and funds are held securely with Stripe during the job. Payment is only released to the guard once the client confirms the shift has been completed satisfactorily. This protects both parties throughout the process.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the platform HMRC compliant?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. QuickGuard.uk is fully HMRC compliant. Guards receive automatic tax documentation and UTR support. All transactions are processed through our secure, regulated payment system.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which areas of the UK does QuickGuard.uk cover?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We cover the entire United Kingdom — including major cities like London, Manchester, Birmingham, Edinburgh, Cardiff, and Belfast, as well as regional and rural areas. Guards can set their preferred coverage radius when creating their profile.',
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
