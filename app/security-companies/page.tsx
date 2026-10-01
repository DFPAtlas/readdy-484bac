import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Emergency Security Staff for Security Companies',
  description:
    'Fill manpower gaps fast with available SIA-licensed security staff. QuickGuard helps security companies cover guard sickness, no-shows, new contracts and major events with short-notice cover.',
  keywords:
    'emergency security staff, SIA security staff, security company manpower, security guard cover, short notice security officers',
  alternates: {
    canonical: 'https://quickguard.uk/security-companies',
  },
  openGraph: {
    title: 'Emergency Security Staff for Security Companies | QuickGuard',
    description:
      'Fill manpower gaps fast with available SIA-licensed security staff. Cover guard sickness, no-shows, new contracts and major events.',
    url: 'https://quickguard.uk/security-companies',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1200&height=630&seq=ind_seccomp_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — emergency security staff for security companies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Emergency Security Staff for Security Companies | QuickGuard',
    description:
      'Fill manpower gaps fast with available SIA-licensed security staff. Cover sickness, no-shows, new contracts and events.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1200&height=630&seq=ind_seccomp_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'security-companies',
  name: 'Security Companies',
  eyebrow: 'Manpower support for security firms',
  headline: 'Short on officers? Fill the gap with QuickGuard.',
  subheadline:
    'Access available SIA-licensed security professionals when your existing workforce cannot cover the requirement. From single-shift sickness cover to additional manpower for new contracts and major events.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1600&height=900&seq=ind_seccomp_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Find Security Staff', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'When your workforce cannot cover the requirement',
  problemsIntro:
    'Security companies lose contracts when cover falls through. These are the gaps QuickGuard is built to help you fill.',
  problems: [
    { icon: 'ri-user-unfollow-line', title: 'Guard calls in sick', desc: 'Same-day absence leaves a shift uncovered with no time to reshuffle your existing team.' },
    { icon: 'ri-run-line', title: 'Officer no-show', desc: 'A no-show at short notice risks the client relationship and the site’s cover.' },
    { icon: 'ri-briefcase-4-line', title: 'New contract starts early', desc: 'A new contract begins before your recruitment and onboarding are complete.' },
    { icon: 'ri-add-circle-line', title: 'Unexpected additional shifts', desc: 'A client requests extra days, extended hours or additional coverage at the last minute.' },
    { icon: 'ri-calendar-event-line', title: 'Event needs extra manpower', desc: 'A one-off event requires a surge of officers beyond your standing roster.' },
    { icon: 'ri-building-4-line', title: 'Multiple sites, simultaneous cover', desc: 'Several sites need cover on the same day and your team is already committed.' },
  ],
  solutionsTitle: 'How QuickGuard solves manpower gaps',
  solutionsIntro:
    'A flexible pool of available professionals you can call on without adding permanent headcount.',
  solutions: [
    { icon: 'ri-flashlight-line', title: 'Short-notice availability', desc: 'Post a requirement and reach available operatives quickly — including same-day cover.' },
    { icon: 'ri-user-search-line', title: 'You choose the operative', desc: 'Review experience, ratings and licence information before you confirm anyone.' },
    { icon: 'ri-toggle-line', title: 'Cover one shift or a surge', desc: 'Fill a single shift, a weekend of absence or a multi-officer event requirement.' },
    { icon: 'ri-shield-check-line', title: 'Licence information shown', desc: 'Profiles display licence details so you can review them against the role.' },
  ],
  rolesTitle: 'Typical roles you can source',
  rolesIntro: 'Operatives across the disciplines security companies most often need to backfill.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Licensed door supervision for venues and events requiring that activity.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General guarding, access control and patrol duties across sites.' },
    { icon: 'ri-camera-line', name: 'CCTV Operators', desc: 'Monitoring and control room operatives for surveillance-led roles.' },
    { icon: 'ri-vip-crown-line', name: 'Close Protection', desc: 'Close protection operatives for higher-risk or principal-focused assignments.' },
    { icon: 'ri-team-line', name: 'Supervisors', desc: 'Experienced supervisors to lead teams on multi-officer deployments.' },
  ],
  useCases: {
    planned: [
      'Planned cover for a new contract while recruitment completes',
      'Additional officers for a scheduled major event',
      'Rostered weekend or seasonal cover across multiple sites',
    ],
    shortNotice: [
      'Sickness or holiday gaps within 24–48 hours',
      'A client adds extra shifts at short notice',
      'A second site needs cover on the same day',
    ],
    emergency: [
      'A no-show leaves a shift uncovered today',
      'Rapid surge cover for an unplanned incident',
      'Immediate backfill to protect a client site',
    ],
  },
  featureMessage: 'Keep the client. Keep the contract. Fill the manpower gap.',
  featureSub:
    'Backfill a shift or add a whole team without committing to permanent recruitment.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Experienced%20security%20supervisor%20in%20black%20uniform%20coordinating%20a%20small%20team%20of%20officers%20with%20a%20tablet%20at%20a%20busy%20UK%20client%20site%20entrance%2C%20focused%20and%20professional%20atmosphere%2C%20deep%20navy%20blue%20and%20teal%20tones%20with%20warm%20rim%20lighting%2C%20cinematic%20documentary%20photography%20style%2C%20sharp%20realistic%20details%2C%20clean%20uncluttered%20background&width=1600&height=900&seq=ind_seccomp_feature_20261001&orientation=landscape',
  complianceNote:
    'Not every security role is licensable in the same way. Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence.',
  faqs: [
    { q: 'Can I source more than one officer at a time?', a: 'Yes. Post a requirement for as many operatives as you need and suitable candidates will be able to respond. You review and select before confirming.' },
    { q: 'How quickly can cover be arranged?', a: 'Many requirements receive responses within minutes. For urgent same-day cover, mark the requirement as immediate when posting so available operatives are prompted.' },
    { q: 'Do I need to be a security company to use QuickGuard?', a: 'QuickGuard is used by security companies, venues and end clients alike. You create a company account and post your requirement through the standard job-posting flow.' },
    { q: 'Will I know if an operative holds the right licence?', a: 'Where licensable activity is involved, licence information is displayed on operatives’ profiles so you can review it against the role before confirming.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post a requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function SecurityCompaniesPage() {
  return (
    <>
      <IndustrySchema
        name="Security Company Manpower Support"
        slug="security-companies"
        description="Emergency and short-notice SIA-licensed security staff for security companies to fill manpower gaps."
      />
      <IndustryPage data={data} />
    </>
  );
}