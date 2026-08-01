import { SITE_URL } from '@/lib/seo-helpers';

export default function GuardGuideSchema() {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Find Security Guard Jobs on QuickGuard',
    description:
      'Complete guide for SIA-licensed guards to register, get verified, find security work across the UK, and receive secure payments through QuickGuard.',
    url: `${SITE_URL}/guide/guard`,
    totalTime: 'PT30M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Create Your Account',
        text: 'Sign up as a guard in minutes. Enter your email, create a password, verify your email, and complete your professional profile with contact details, SIA licence number, and experience.',
        url: `${SITE_URL}/guide/guard#step-01`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'SIA Verification',
        text: 'Submit your SIA licence number during profile setup. Our system automatically checks against the official SIA register and approval typically completes within 5–10 minutes.',
        url: `${SITE_URL}/guide/guard#step-02`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Find and Apply for Jobs',
        text: 'Browse available security jobs near you. Each listing shows pay rate, schedule, requirements, and location. Apply with a single click and receive instant notifications when accepted.',
        url: `${SITE_URL}/guide/guard#step-03`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Complete Jobs and Get Paid',
        text: 'Work your assigned shift professionally. The client processes payment through the platform after completion and funds are securely transferred to your registered UK bank account.',
        url: `${SITE_URL}/guide/guard#step-04`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}