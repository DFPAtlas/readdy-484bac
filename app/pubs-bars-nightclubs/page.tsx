import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Door Supervision for Pubs, Bars & Nightclubs',
  description:
    'Post door supervision requirements for your pub, bar or nightclub. A guest check counts guards whose recorded availability matches the shift, then you sign in to review applicants and pay through Stripe before a booking is confirmed.',
  keywords:
    'door supervisor cover, door staff nightclub, SIA door supervisors, pub security staff, bar door staff',
  alternates: {
    canonical: 'https://quickguard.uk/pubs-bars-nightclubs',
  },
  openGraph: {
    title: 'Door Supervision for Pubs, Bars & Nightclubs | QuickGuard',
    description:
      'Check recorded guard availability for a venue shift, review the applicants who apply, and confirm a booking with a successful Stripe payment.',
    url: 'https://quickguard.uk/pubs-bars-nightclubs',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1200&height=630&seq=ind_pubs_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — Door supervision for pubs, bars and nightclubs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Door Supervision for Pubs, Bars & Nightclubs | QuickGuard',
    description:
      'Check recorded guard availability for a venue shift, review applicants, and confirm a booking with a successful Stripe payment.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1200&height=630&seq=ind_pubs_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'pubs-bars-nightclubs',
  name: 'Pubs, Bars & Nightclubs',
  eyebrow: 'Venue door supervision',
  headline: 'Door supervision for pubs, bars and nightclubs.',
  subheadline:
    'Check recorded guard availability for your shift, review the guards who apply, and confirm a booking once your payment succeeds.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20UK%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%2C%20cinematic%20high-end%20photography%20style%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20dramatic%20rim%20light%2C%20simple%20uncluttered%20composition&width=1600&height=900&seq=ind_pubs_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Post a Venue Requirement', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'The staffing headaches venues know too well',
  problemsIntro:
    'A venue’s door is part of its reputation. These are the cover gaps QuickGuard is built around.',
  problems: [
    { icon: 'ri-emotion-sad-line', title: 'Friday or Saturday sickness', desc: 'Your busiest nights are exactly when an absent door supervisor hurts most.' },
    { icon: 'ri-close-circle-line', title: 'Door Supervisor cancellation', desc: 'A late cancellation can leave you short on the door with little time to reorganise.' },
    { icon: 'ri-calendar-check-line', title: 'Bank holiday demand', desc: 'Extended trading and bigger crowds stretch a small regular team thin.' },
    { icon: 'ri-sparkling-line', title: 'Special events', desc: 'Guest DJs, theme nights and one-off events need more door presence.' },
    { icon: 'ri-football-line', title: 'Football nights', desc: 'Big fixtures bring higher volumes and a greater need for visible cover.' },
    { icon: 'ri-goblet-line', title: 'Christmas and New Year', desc: 'The busiest trading period needs reliable, licensed door staff on every night.' },
    { icon: 'ri-alert-line', title: 'Changed licensing conditions', desc: 'A variation to your premises licence can change the level of door supervision required.' },
  ],
  solutionsTitle: 'How QuickGuard works for a venue',
  solutionsIntro:
    'From a recorded-availability check to a paid, confirmed booking — with the licence type matched to the duties.',
  solutions: [
    { icon: 'ri-calendar-check-line', title: 'Recorded availability check', desc: 'A guest check counts guards whose recorded availability, travel radius, listed minimum rate and licence type match the shift you describe. It is an indicator only — not a reservation and not a guarantee of cover.' },
    { icon: 'ri-user-search-line', title: 'You review the applicants', desc: 'Once you sign in and post within your plan’s monthly job allowance, eligible guards can apply. You compare profiles, experience, ratings and the licence information shown before choosing.' },
    { icon: 'ri-checkbox-circle-line', title: 'Selection is provisional', desc: 'Choosing guards does not secure the night on its own. The selection stays provisional until the booking payment is completed.' },
    { icon: 'ri-bank-card-line', title: 'Payment confirms the booking', desc: 'The booking is confirmed only after a successful card payment through Stripe. Posting a requirement on its own takes no payment.' },
  ],
  rolesTitle: 'Typical roles for venues',
  rolesIntro: 'Each role carries its own SIA licence requirement, so the licence type is matched to the duties.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Where the duties amount to licensable door supervision, the operative needs a current SIA Door Supervisor licence.' },
    { icon: 'ri-camera-line', name: 'CCTV Operators', desc: 'For monitoring a venue’s public space cameras, the relevant SIA licence is a CCTV (public space surveillance) licence.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'Where the duties do not amount to door supervision, a Security Guard licence may be the matching one. Check the licence type against the duties before you post.' },
  ],
  useCases: {
    planned: [
      'Weekend door supervision posted in advance',
      'Extra licensed door staff for a booked event night',
      'Regular weekly cover for the nights you need it',
    ],
    shortNotice: [
      'Filling a gap after a late cancellation',
      'Extra cover when a night is busier than expected',
      'Cover while a regular team member is on leave',
    ],
    emergency: [
      'A no-show on a busy night — post and check recorded availability',
      'Backfill while you contact your regular team',
      'Review the guards who apply, then confirm with payment',
    ],
  },
  example: {
    title: 'An example venue requirement',
    subtitle: 'These are the details you would enter when posting a night.',
    rows: [
      { label: 'Venue postcode', value: 'Your venue postcode' },
      { label: 'Licence required', value: 'Door Supervisor, where the duties require it' },
      { label: 'Date', value: 'The night you need cover' },
      { label: 'Start and finish', value: 'Your trading hours' },
      { label: 'Number required', value: 'How many operatives you need' },
      { label: 'Hourly rate', value: 'The rate you set — guards decide whether to apply' },
      { label: 'Booking service fee', value: 'Your plan’s fee, shown before payment and separate from guard pay' },
    ],
    note: 'Illustrative example only. Availability is counted from guards’ recorded availability and can change, so a check is not a reservation. The booking is confirmed only after a successful Stripe payment.',
  },
  featureMessage: 'Door supervision cover for the nights that matter.',
  featureSub: 'Check recorded availability, review the applicants, then confirm with payment.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Two%20friendly%20SIA%20door%20supervisors%20in%20black%20uniforms%20managing%20a%20queue%20outside%20a%20lively%20British%20bar%20on%20a%20Friday%20night%2C%20warm%20neon%20reflections%20on%20wet%20pavement%2C%20surrounding%20city%20lights%20in%20soft%20bokeh%2C%20deep%20blue%20and%20teal%20colour%20grading%2C%20documentary%20nightlife%20photography%20style%20with%20realistic%20sharp%20detail&width=1600&height=900&seq=ind_pubs_feature_20261001&orientation=landscape',
  complianceNote:
    'Door supervision is a licensable activity when it is carried out for a venue, and the relevant SIA licence is the Door Supervisor licence. Other duties may need a different licence, such as a CCTV (public space surveillance) licence for monitoring public space cameras. QuickGuard shows the licence information recorded for each guard so you can check it against the duties you need covered. This is general information, not legal or licensing advice — confirm your own obligations with your licensing authority or a qualified adviser.',
  faqs: [
    { q: 'What does the availability check actually do?', a: 'Before you sign in you can run a guest check. It counts guards whose recorded availability, travel radius, listed minimum hourly rate and licence type match the shift details you enter. It is an indicator of recorded availability only. It does not hold, reserve or guarantee anyone, and a guard’s availability can change.' },
    { q: 'What happens after I check availability?', a: 'You sign in or create a company account, then post the requirement. Posting is subject to your client plan’s monthly job allowance and does not take any payment.' },
    { q: 'Do guards pay to apply for venue work?', a: 'No. Applications are free for eligible guards and there is no monthly application cap. Eligibility includes an active account, a completed profile, approval on the platform and a valid SIA licence that matches the job’s licence requirement.' },
    { q: 'When is my booking actually confirmed?', a: 'Selecting guards leaves the booking provisional. It is confirmed only when your card payment through Stripe succeeds. Until that payment completes, the night is not secured.' },
    { q: 'Is the booking fee taken out of the guard’s pay?', a: 'No. Your client plan’s booking service fee is charged on top of the agreed gross guard pay, never deducted from it. The guard’s agreed pay is the posted hourly rate for the hours worked, with no guard booking commission on new bookings. The fee that applies, and any eligible promotion, is shown before you pay.' },
    { q: 'Are there paid guard memberships, tiers or priority placement?', a: 'No. Guard job access and applications are free, and paid guard memberships, tiers and paid priority placement are not offered. Guards are matched on eligibility and the details of the requirement, not on a paid status.' },
    { q: 'Are the door supervisors licensed?', a: 'Where the duties are licensable door supervision, a current SIA Door Supervisor licence is required for the guard to be eligible, and the licence information recorded on the profile is shown for you to check. Other duties may need a different licence, so match the licence type to the duties you are covering.' },
    { q: 'Can I post a single night rather than a full contract?', a: 'Yes. Post the one shift you need. There is no minimum number of nights and no long-term contract required.' },
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
        description="Door supervision cover for pubs, bars and nightclubs. Venues check recorded guard availability, review applicants, and confirm a booking after a successful Stripe payment."
      />
      <IndustryPage data={data} />
    </>
  );
}