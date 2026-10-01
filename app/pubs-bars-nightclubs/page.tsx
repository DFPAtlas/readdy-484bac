import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Door Supervisor Cover for Pubs, Bars & Nightclubs',
  description:
    'Find SIA Door Supervisor cover for your pub, bar or nightclub. QuickGuard helps venues source licensed door staff for weekends, events and short-notice shifts across the UK.',
  keywords:
    'door supervisor cover, door staff nightclub, SIA door supervisors, pub security staff, bar doormen cover',
  alternates: {
    canonical: 'https://quickguard.uk/pubs-bars-nightclubs',
  },
  openGraph: {
    title: 'Door Supervisor Cover for Pubs, Bars & Nightclubs | QuickGuard',
    description:
      'Find SIA Door Supervisor cover for weekends, events and short-notice venue shifts across the UK.',
    url: 'https://quickguard.uk/pubs-bars-nightclubs',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1200&height=630&seq=ind_pubs_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — SIA Door Supervisor cover for pubs, bars and nightclubs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Door Supervisor Cover for Pubs, Bars & Nightclubs | QuickGuard',
    description:
      'Find SIA Door Supervisor cover for weekends, events and short-notice venue shifts.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1200&height=630&seq=ind_pubs_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'pubs-bars-nightclubs',
  name: 'Pubs, Bars & Nightclubs',
  eyebrow: 'Venue door staff cover',
  headline: 'Door staff let you down? Find licensed cover quickly.',
  subheadline:
    'Find available SIA Door Supervisors for weekends, events and short-notice venue cover.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1600&height=900&seq=ind_pubs_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Find Door Staff', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'The staffing headaches venues know too well',
  problemsIntro:
    'A venue’s reputation depends on the door. These are the cover gaps QuickGuard helps you fill.',
  problems: [
    { icon: 'ri-emotion-sad-line', title: 'Friday or Saturday sickness', desc: 'Your busiest nights are exactly when an absent door supervisor hurts most.' },
    { icon: 'ri-close-circle-line', title: 'Door Supervisor cancellation', desc: 'A late cancellation leaves you short on the door with hours to go.' },
    { icon: 'ri-calendar-check-line', title: 'Bank holiday demand', desc: 'Extended trading and bigger crowds stretch a small regular team thin.' },
    { icon: 'ri-sparkling-line', title: 'Special events', desc: 'Guest DJs, theme nights and one-off events need more door presence.' },
    { icon: 'ri-football-line', title: 'Football nights', desc: 'Big fixtures bring higher volumes and a greater need for visible cover.' },
    { icon: 'ri-goblet-line', title: 'Christmas and New Year', desc: 'The busiest trading period needs reliable, licensed door staff on every night.' },
    { icon: 'ri-alert-line', title: 'Increased security requirement', desc: 'Local conditions or a licensing requirement push up the level of cover you need.' },
  ],
  solutionsTitle: 'How QuickGuard covers your door',
  solutionsIntro:
    'Find available licensed door staff for a single night, a weekend or a full season.',
  solutions: [
    { icon: 'ri-flashlight-line', title: 'Short-notice availability', desc: 'Reach available door supervisors quickly when a shift needs filling.' },
    { icon: 'ri-user-search-line', title: 'Choose your door team', desc: 'Review profiles, ratings and licence information before you confirm.' },
    { icon: 'ri-calendar-2-line', title: 'Book by the night', desc: 'Cover one weekend or plan a season — with no long-term contract required.' },
    { icon: 'ri-shield-check-line', title: 'Licence information shown', desc: 'Where the role is licensable, door supervisor licence details are shown on profiles.' },
  ],
  rolesTitle: 'Typical roles for venues',
  rolesIntro: 'The door and venue roles most often requested by pubs, bars and nightclubs.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Licensed door supervision for venues where that activity is required.' },
    { icon: 'ri-team-line', name: 'Security Supervisors', desc: 'Experienced supervisors to lead the door team on busier nights.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General venue security cover where the role does not require door supervision.' },
  ],
  useCases: {
    planned: [
      'Rostered weekend door cover booked in advance',
      'Extra door staff for a scheduled seasonal or event night',
      'Regular weekly cover for a growing venue',
    ],
    shortNotice: [
      'Filling a shift cancelled within 48 hours',
      'Extra cover for an unexpectedly busy night',
      'Cover while a regular team member is on holiday',
    ],
    emergency: [
      'A door supervisor no-shows on a Saturday night',
      'Same-evening cover for an unplanned demand surge',
      'Immediate backfill to keep the door fully covered',
    ],
  },
  example: {
    title: 'A simple venue requirement',
    subtitle: 'Post the shift details and available door supervisors can respond.',
    rows: [
      { label: 'Venue postcode', value: 'M1 4BT' },
      { label: 'Date', value: 'Saturday 14 December' },
      { label: 'Start time', value: '20:00' },
      { label: 'Finish time', value: '04:00' },
      { label: 'Number required', value: '3 door supervisors' },
      { label: 'Rate', value: '£16 per hour' },
    ],
    note: 'This is an illustrative example only. Posting your requirement uses the existing QuickGuard job-posting flow — it is not a separate system.',
  },
  featureMessage: 'Reliable door cover, even when your regular team cannot make it.',
  featureSub: 'Find available licensed door supervisors for the nights that matter most.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Two%20friendly%20SIA%20door%20supervisors%20in%20black%20uniforms%20managing%20a%20queue%20outside%20a%20lively%20British%20bar%20on%20a%20Friday%20night%2C%20warm%20neon%20reflections%20on%20wet%20pavement%2C%20surrounding%20city%20lights%20in%20soft%20bokeh%2C%20deep%20blue%20and%20teal%20colour%20grading%2C%20documentary%20nightlife%20photography%20style%20with%20realistic%20sharp%20detail&width=1600&height=900&seq=ind_pubs_feature_20261001&orientation=landscape',
  complianceNote:
    'Door supervision is a licensable activity where it is being carried out for the venue. Other roles may not require a licence, so QuickGuard shows licence information where it is relevant to the role.',
  faqs: [
    { q: 'Can I book door staff for just one night?', a: 'Yes. Post the single shift and available door supervisors can respond. There is no minimum number of nights.' },
    { q: 'How quickly can I find door cover?', a: 'Many requirements receive responses within minutes. Mark the shift as urgent if you need same-night cover.' },
    { q: 'Will the door supervisors be licensed?', a: 'Where the role involves licensable door supervision, QuickGuard shows licence information on the operative’s profile so you can review it before confirming.' },
    { q: 'Can I request more than one door supervisor?', a: 'Yes. Set how many operatives you need and suitable candidates can respond to the same requirement.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post a shift', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function PubsBarsNightclubsPage() {
  return (
    <>
      <IndustrySchema
        name="Pubs, Bars & Nightclubs Security"
        slug="pubs-bars-nightclubs"
        description="SIA Door Supervisor cover for pubs, bars and nightclubs, including short-notice weekend and event cover."
      />
      <IndustryPage data={data} />
    </>
  );
}