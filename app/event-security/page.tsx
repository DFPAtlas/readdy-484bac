import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Event Security Staff for Festivals & Venues',
  description:
    'Find event security staff for concerts, festivals, exhibitions, sporting events and private functions. QuickGuard helps you build a licensed event security team in one place.',
  keywords:
    'event security staff, festival security, concert security, event security guards, exhibition security staff',
  alternates: {
    canonical: 'https://quickguard.uk/event-security',
  },
  openGraph: {
    title: 'Event Security Staff for Festivals & Venues | QuickGuard',
    description:
      'Find event security staff for concerts, festivals, exhibitions, sporting events and private functions.',
    url: 'https://quickguard.uk/event-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_events_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — event security staff for festivals, concerts and venues',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Event Security Staff for Festivals & Venues | QuickGuard',
    description:
      'Find event security staff for concerts, festivals, exhibitions, sporting events and private functions.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_events_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'event-security',
  name: 'Events & Festivals',
  eyebrow: 'Event security staffing',
  headline: 'Build your event security team in one place.',
  subheadline:
    'Find licensed security professionals for concerts, festivals, exhibitions, sporting events and private functions.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_events_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Staff Your Event', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'Event staffing, without the last-minute panic',
  problemsIntro:
    'Events need the right people in the right roles, often at short notice. These are the pressures QuickGuard helps you manage.',
  problems: [
    { icon: 'ri-group-line', title: 'Large temporary workforce needed', desc: 'Events require a sizeable team for a short period rather than permanent staff.' },
    { icon: 'ri-refresh-line', title: 'Late staffing changes', desc: 'Plans shift quickly and your security numbers need to keep pace.' },
    { icon: 'ri-layout-grid-line', title: 'Multiple security roles', desc: 'One event can need several different disciplines working together.' },
    { icon: 'ri-user-unfollow-line', title: 'Staff cancellations', desc: 'Late drop-outs can leave a gap right before gates open.' },
    { icon: 'ri-bar-chart-line', title: 'Increased attendance', desc: 'Higher-than-expected numbers change the level of cover required.' },
    { icon: 'ri-shield-check-line', title: 'Last-minute requirements', desc: 'Specific roles may need particular licence types at short notice.' },
  ],
  solutionsTitle: 'How QuickGuard helps staff your event',
  solutionsIntro:
    'Build a team across multiple roles and review the details before you confirm.',
  solutions: [
    { icon: 'ri-group-2-line', title: 'Source multiple operatives', desc: 'Reach a broad pool of professionals when you need a bigger team.' },
    { icon: 'ri-user-search-line', title: 'Review before you choose', desc: 'Compare experience, ratings and licence information for each role.' },
    { icon: 'ri-layout-grid-line', title: 'Plan across disciplines', desc: 'Identify candidates for the different security roles your event needs.' },
    { icon: 'ri-flashlight-line', title: 'Short-notice support', desc: 'Find available operatives when last-minute gaps appear.' },
  ],
  rolesTitle: 'Typical event security roles',
  rolesIntro: 'The roles most often requested across concerts, festivals and private functions.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Licensed door supervision for entry, access and front-of-house duties.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General event security covering perimeters, areas and crowd-facing duties.' },
    { icon: 'ri-camera-line', name: 'CCTV Operators', desc: 'Monitoring and control room operatives for larger venues and sites.' },
    { icon: 'ri-vip-crown-line', name: 'Close Protection', desc: 'Close protection operatives for VIP or higher-risk event assignments.' },
    { icon: 'ri-team-line', name: 'Team Leaders / Supervisors', desc: 'Supervisors to coordinate and lead security teams across a site.' },
  ],
  useCases: {
    planned: [
      'Building a full event security team ahead of an event date',
      'Planning multi-role cover across a large site',
      'Booking stewards and supervisors for a scheduled festival',
    ],
    shortNotice: [
      'Adding operatives after a rise in expected attendance',
      'Replacing late cancellations before gates open',
      'Sourcing a specific role shortly before the event',
    ],
    emergency: [
      'Rapid cover when a team member drops out on the day',
      'Same-day support for an unplanned surge in demand',
      'Immediate backfill to keep key posts manned',
    ],
  },
  example: {
    title: 'An example multi-role event requirement',
    subtitle: 'One event can need several roles working together across the site.',
    rows: [
      { label: 'Role 1', value: '25 Door Supervisors' },
      { label: 'Role 2', value: '10 Security Guards' },
      { label: 'Role 3', value: '2 Supervisors' },
      { label: 'Role 4', value: '1 CCTV Operator' },
    ],
    note: 'This is an explanatory example of a typical event staffing mix. Multi-role event booking is not part of this phase — requirements are posted through the existing QuickGuard flow.',
  },
  featureMessage: 'One event. Several roles. Built in one place.',
  featureSub: 'Bring together the licensed professionals your event needs across every security discipline.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Large%20team%20of%20licensed%20event%20security%20staff%20in%20black%20uniforms%20spread%20across%20a%20busy%20UK%20festival%20arena%20managing%20crowds%20near%20a%20main%20stage%20with%20dramatic%20lighting%2C%20organised%20and%20professional%20atmosphere%2C%20deep%20blue%20and%20teal%20tones%20with%20warm%20stage%20glow%2C%20cinematic%20documentary%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_events_feature_20261001&orientation=landscape',
  complianceNote:
    'Not every role at an event is licensable. Stewarding and some non-security duties may not require an SIA licence. Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence.',
  faqs: [
    { q: 'Can I source several security roles for one event?', a: 'You can post your event requirements through the existing QuickGuard flow and review suitable professionals for the roles you need. Multi-role event booking is planned for a later phase.' },
    { q: 'Do all event staff need an SIA licence?', a: 'No. Not every role at an event is licensable — for example, some stewarding duties may not require a licence. Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence.' },
    { q: 'How far in advance should I arrange event security?', a: 'Earlier is better for larger events, but QuickGuard also supports short-notice requirements when a gap appears close to the event date.' },
    { q: 'Can I book door supervisors for the entrance?', a: 'Yes. If your event requires licensed door supervision, you can look for door supervisors alongside other security roles.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your event requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function EventSecurityPage() {
  return (
    <>
      <IndustrySchema
        name="Event Security Staffing"
        slug="event-security"
        description="Event security staff for concerts, festivals, exhibitions, sporting events and private functions."
      />
      <IndustryPage data={data} />
    </>
  );
}