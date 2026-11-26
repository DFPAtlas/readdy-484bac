import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Additional Security Officers for Security Companies',
  description:
    'Security companies can post additional officer requirements, review the guards who apply, make a provisional selection and pay by card through Stripe before a booking is confirmed. Client fees are plan-based and separate from the gross pay agreed with the officer.',
  keywords:
    'additional security officers, security company cover, SIA licensed officers, security staffing requests, guard applications, security company portal',
  alternates: {
    canonical: 'https://quickguard.uk/security-companies',
  },
  openGraph: {
    title: 'Additional Security Officers for Security Companies | QuickGuard',
    description:
      'Post an additional officer requirement, review the guards who apply and make a provisional selection. A booking is confirmed only after card payment succeeds.',
    url: 'https://quickguard.uk/security-companies',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1200&height=630&seq=ind_seccomp_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — additional security officers for security companies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Additional Security Officers for Security Companies | QuickGuard',
    description:
      'Post a requirement, review applications and provisionally select officers. Confirmation follows successful card payment.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1200&height=630&seq=ind_seccomp_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'security-companies',
  name: 'Security Companies',
  eyebrow: 'Additional officer cover for security firms',
  headline: 'Additional officers when your own rota cannot cover it.',
  subheadline:
    'Post the requirement and review the officers who apply. Availability is checked at a point in time and is not a reservation, and nothing is booked until you have reviewed the applications, made a provisional selection and the card payment has completed successfully.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20team%20of%20SIA-licensed%20security%20officers%20in%20smart%20black%20uniforms%20standing%20confidently%20outside%20a%20modern%20UK%20corporate%20office%20building%20at%20dusk%2C%20visible%20SIA%20badges%2C%20moody%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20soft%20city%20bokeh%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20corporate%20photography%20style%2C%20realistic%20sharp%20details%2C%20uncluttered%20premium%20composition&width=1600&height=900&seq=ind_seccomp_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Post a Requirement', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Client Account', href: '/client/register' },
  problemsTitle: 'Where additional officer cover is usually needed',
  problemsIntro:
    'These are the situations where a security company looks outside its own roster. In each case the requirement still goes through review, selection and payment like any other booking.',
  problems: [
    { icon: 'ri-user-unfollow-line', title: 'Officer calls in sick', desc: 'A same-day absence leaves a shift without cover while your remaining officers are already rostered elsewhere.' },
    { icon: 'ri-run-line', title: 'Officer does not arrive', desc: 'A no-show leaves the post uncovered and puts the client relationship at risk.' },
    { icon: 'ri-briefcase-4-line', title: 'New contract starts before recruitment finishes', desc: 'A contract begins before your own recruitment, screening and onboarding are complete.' },
    { icon: 'ri-add-circle-line', title: 'Client asks for extra shifts', desc: 'A client adds days, extends hours or requests an additional post after your rota is published.' },
    { icon: 'ri-calendar-event-line', title: 'One-off event needs more officers', desc: 'A single event needs more officers than your standing roster can provide on that date.' },
    { icon: 'ri-building-4-line', title: 'Sites overlap on the same day', desc: 'Several sites need cover at once and your available officers are already committed.' },
  ],
  solutionsTitle: 'What this actually gives you',
  solutionsIntro:
    'Additional candidates to review when your own roster cannot cover the requirement. Availability is never guaranteed, and no officer is held for you until a booking is paid and confirmed.',
  solutions: [
    { icon: 'ri-user-search-line', title: 'More officers to review', desc: 'Post the requirement and review the guards who apply or match it. You are not obliged to select anyone.' },
    { icon: 'ri-timer-flash-line', title: 'Near-term requests accepted', desc: 'You can post for a close date. Whether officers are available depends on live availability at that moment, and a match does not hold anyone.' },
    { icon: 'ri-shield-check-line', title: 'Licence detail on the profile', desc: 'Where the post involves licensable activity, the licence recorded for the operative is shown on the profile so you can check it against the duties.' },
    { icon: 'ri-money-pound-circle-line', title: 'Officer pay and fee kept separate', desc: 'The gross hourly rate you agree for the officer is separate from the plan-based QuickGuard service fee, which is shown before you pay.' },
  ],
  rolesTitle: 'Role types and the licence each activity needs',
  rolesIntro:
    'Licensable activity under the SIA scheme is role-specific. Match the requirement to the duties the post actually involves rather than assuming one licence covers every officer.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Door supervision at licensed premises and events is a licensable activity of its own. State door supervision as the required licence on the post.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'Static guarding, access control and patrol duties. Where the post involves licensable guarding activity, state the guarding licence on the requirement.' },
    { icon: 'ri-camera-line', name: 'CCTV Operators', desc: 'Public space surveillance (CCTV) is a separate licence activity. State it on the requirement when the post involves it.' },
    { icon: 'ri-vip-crown-line', name: 'Close Protection', desc: 'Close protection is its own licence activity, usually for principal-focused assignments. State it explicitly — it is not interchangeable with door supervision or guarding.' },
    { icon: 'ri-team-line', name: 'Supervisors', desc: 'Team-lead and supervisory posts. The licence needed depends on the licensable activity the supervisor will personally carry out.' },
    { icon: 'ri-footprint-line', name: 'Dog Handlers', desc: 'Dog handling is a separate licence activity. State it on the requirement rather than treating it as covered by a guarding licence.' },
  ],
  useCases: {
    planned: [
      'Additional officers for a new contract while your recruitment completes',
      'Extra officers rostered for a scheduled event',
      'Weekend or seasonal cover alongside your own team',
    ],
    shortNotice: [
      'A rota gap inside the next day or two',
      'A client adds shifts after your rota is published',
      'A second site needs cover on the same date',
    ],
    emergency: [
      'A same-day absence — check live availability before relying on cover',
      'A match shows who is available now and does not hold an officer',
      'A posted requirement only becomes a booking once payment succeeds',
    ],
  },
  example: {
    title: 'How pay, fees and confirmation fit together',
    subtitle: 'Officer pay and the QuickGuard fee are separate, and the booking exists only after payment succeeds.',
    rows: [
      { label: 'Agreed gross rate for the officer', value: 'Set on the requirement' },
      { label: 'QuickGuard service fee', value: 'From your client plan, shown before payment' },
      { label: 'Payment', value: 'Card through Stripe' },
      { label: 'Booking confirmation', value: 'Only after the payment succeeds' },
    ],
    note: 'No amounts are shown here because they depend on your client plan and the rate you agree. Nothing on this page is a quotation, and no cover is guaranteed.',
  },
  featureMessage: 'Review the officers, then confirm the booking.',
  featureSub:
    'Additional cover for a single shift or a run of dates, with the officer pay and the platform fee shown separately before you pay.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Experienced%20security%20supervisor%20in%20black%20uniform%20coordinating%20a%20small%20team%20of%20officers%20with%20a%20tablet%20at%20a%20busy%20UK%20client%20site%20entrance%2C%20focused%20and%20professional%20atmosphere%2C%20deep%20navy%20blue%20and%20teal%20tones%20with%20warm%20rim%20lighting%2C%20cinematic%20documentary%20photography%20style%2C%20sharp%20realistic%20details%2C%20clean%20uncluttered%20background&width=1600&height=900&seq=ind_seccomp_feature_20261001&orientation=landscape',
  complianceNote:
    'Licensing depends on the activity a post involves, not on its job title. QuickGuard shows the licence recorded for each operative and the licence the requirement asks for so you can check that they match. This is information for your own review and is not legal advice.',
  faqs: [
    {
      q: 'How does a booking actually get confirmed?',
      a: 'You post the requirement, review the officers who apply or match it, and make a provisional selection. The booking is confirmed only once the agreed gross officer pay plus the plan-based QuickGuard fee has been paid by card through Stripe. Until that payment succeeds, the requirement is not a confirmed booking.',
    },
    {
      q: 'Does an availability check reserve officers?',
      a: 'No. Availability is checked at the moment you ask and reflects who is eligible and available for those details. It is not a reservation or a hold, and officers can be booked by someone else before you confirm.',
    },
    {
      q: 'Can I post a requirement for today?',
      a: 'You can post for a near-term date, including today, but cover is never guaranteed. It depends on eligible officers being available, applying, and your selection being paid and confirmed in time.',
    },
    {
      q: 'Is the QuickGuard fee taken out of the officer’s pay?',
      a: 'No. The gross hourly rate you agree for the officer is shown separately from the QuickGuard service fee. The fee is calculated from your client plan as a percentage plus a fixed amount per guard, and both figures are displayed before you pay.',
    },
    {
      q: 'Do officers pay to apply, and can priority be bought?',
      a: 'Guard applications are free with no monthly cap. The paid guard membership tiers have been retired and no paid priority placement is sold, so the officers you see are matched on your requirement rather than on what they paid.',
    },
    {
      q: 'Does the company portal handle bookings for me?',
      a: 'The company portal is a company record view for administrator-issued accounts, covering sites, staff, rotas, incidents, compliance and training records; reporting and in-portal messaging are still limited. Booking cover runs through a client account and the job-posting journey. Client registration does not activate a company portal account.',
    },
    {
      q: 'Can I be sure an officer holds the right licence?',
      a: 'The requirement states the licence you need and the licence record is shown on each operative’s profile, so you can check that the activity matches the duties. QuickGuard does not provide legal advice on licensing.',
    },
    {
      q: 'Can I request several officers or several dates at once?',
      a: 'Yes. You can request multiple officer positions and a run of dates in one requirement. Availability still has to be established through applications, your provisional selection and a successful payment.',
    },
  ],
  relatedLinks: [
    { label: 'Create a client account', href: '/client/register' },
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
        name="Additional Security Officer Cover for Security Companies"
        slug="security-companies"
        description="Security companies can post additional officer requirements, review applications, make a provisional selection and confirm a booking only after successful card payment."
      />
      <IndustryPage data={data} />
    </>
  );
}