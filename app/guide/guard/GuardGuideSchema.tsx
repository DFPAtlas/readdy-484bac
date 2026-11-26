import { SITE_URL } from '@/lib/seo-helpers';
import { GUARD_PAYMENT_STEPS, GUARD_GUIDE_FAQS } from './guardGuideContent';

export default function GuardGuideSchema() {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Find Security Guard Jobs on QuickGuard',
    description:
      'How SIA-licensed guards create a free account, complete licence review, apply for security work and follow shift payments through Stripe on QuickGuard.',
    url: `${SITE_URL}/guide/guard`,
    totalTime: 'PT30M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Create Your Free Account',
        text: 'Sign up as a guard. There is no charge to register, browse jobs or apply. Enter your email, create a password, verify your email, and complete your profile with contact details, SIA licence number, licence types and experience.',
        url: `${SITE_URL}/guide/guard#step-01`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'SIA Licence Review',
        text: 'Your SIA licence details are reviewed before your account is approved. Review can include a check against the SIA register and may require manual review, so timing varies. An expired licence blocks applications, and your licence number and types appear on your profile.',
        url: `${SITE_URL}/guide/guard#step-02`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Browse and Apply for Jobs',
        text: 'Browse open jobs and apply for free with no monthly application cap and no paid job tiers. Each listing shows pay rate, schedule, requirements and location. Clients review applications and select guards, so applying does not guarantee selection or work.',
        url: `${SITE_URL}/guide/guard#step-03`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Work Shifts and Get Paid',
        text: GUARD_PAYMENT_STEPS.map((step) => `${step.label}: ${step.desc}`).join(' '),
        url: `${SITE_URL}/guide/guard#step-04`,
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GUARD_GUIDE_FAQS.map((faq) => ({
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
        name: 'Guard Guide',
        item: `${SITE_URL}/guide/guard`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}