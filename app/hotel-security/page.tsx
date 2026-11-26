import type { Metadata } from 'next';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';
import HotelSecurityPage from './HotelSecurityPage';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20hotel%20security%20officer%20in%20a%20well-tailored%20dark%20suit%20with%20a%20subtle%20earpiece%2C%20standing%20at%20ease%20beside%20the%20reception%20desk%20of%20an%20elegant%20UK%20hotel%20lobby%2C%20warm%20chandelier%20lighting%20glinting%20off%20polished%20marble%20floors%20and%20brass%20details%2C%20velvet%20armchairs%20and%20a%20grand%20staircase%20softly%20blurred%20behind%2C%20a%20guest%20checking%20in%20in%20the%20distance%2C%20cinematic%20wide%20angle%20with%20the%20officer%20placed%20on%20the%20right%20and%20a%20deep%20shadowed%20area%20across%20the%20whole%20left%20half%20of%20the%20frame%20for%20white%20headline%20text%2C%20warm%20gold%20and%20deep%20navy%20tones%2C%20premium%20hospitality%20editorial%20photography%2C%20crisp%20realistic%20detail&width=1600&height=900&seq=hotel_lobby_security_20261118&orientation=landscape';

const FEATURE_IMAGE =
  'https://readdy.ai/api/search-image?query=Licensed%20door%20supervisor%20in%20a%20smart%20dark%20suit%20providing%20discreet%20security%20at%20an%20elegant%20UK%20hotel%20wedding%20reception%20with%20warm%20string%20lights%20and%20draped%20marquee%20fabric%20softly%20blurred%20behind%2C%20calm%20professional%20atmosphere%2C%20deep%20blue%20and%20teal%20tones%20with%20golden%20highlights%2C%20high-end%20hospitality%20photography%20style%2C%20sharp%20realistic%20detail&width=1600&height=900&seq=ind_hotel_feature_20261001&orientation=landscape';

const SOCIAL_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20officer%20in%20a%20smart%20dark%20suit%20standing%20discreetly%20in%20the%20elegant%20lobby%20of%20a%20luxury%20UK%20hotel%20with%20warm%20chandelier%20lighting%20and%20marble%20finishes%2C%20calm%20and%20attentive%20posture%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20golden%20highlights%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20hospitality%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_hotel_hero_20261001&orientation=landscape';

export const metadata: Metadata = {
  title: 'Hotel & Hospitality Security Cover',
  description:
    'Check recorded guard availability for a hotel shift, sign in to review the guards who apply, and confirm the booking only once payment succeeds.',
  keywords:
    'hotel security, hospitality security, hotel security officers, reception security, access control, hotel patrol officers, event security at hotels, licensed premises security',
  alternates: {
    canonical: 'https://quickguard.uk/hotel-security',
  },
  openGraph: {
    title: 'Hotel & Hospitality Security Cover | QuickGuard',
    description:
      'Check recorded guard availability for a hotel shift, review the guards who apply, and confirm the booking once payment succeeds.',
    url: 'https://quickguard.uk/hotel-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: 'QuickGuard — hotel and hospitality security cover',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hotel & Hospitality Security Cover | QuickGuard',
    description:
      'Check recorded guard availability for a hotel shift, review the guards who apply, and confirm the booking once payment succeeds.',
    images: [SOCIAL_IMAGE],
  },
};

const data: Omit<IndustryData, 'useCases' | 'complianceNote'> = {
  slug: 'hotel-security',
  name: 'Hotels & Hospitality',
  eyebrow: 'Hotel and hospitality security',
  headline: 'Security cover for hotels, functions and out-of-hours nights.',
  subheadline:
    'Check recorded guard availability for a hotel shift, review the guards who apply, and confirm the booking only when payment succeeds.',
  heroImage: HERO_IMAGE,
  primaryCta: { label: 'Post a Hotel Requirement', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'Where a hotel or venue needs extra security',
  problemsIntro:
    'Hospitality buildings are open, busy and full of people who are not always where they should be. These are the duties hotels usually ask cover for.',
  problems: [
    { icon: 'ri-hotel-line', title: 'An open front of house', desc: 'Lobbies, bars and function suites are hard to watch when the team is busy with guests.' },
    { icon: 'ri-door-lock-line', title: 'Back-of-house access', desc: 'Staff doors, goods-in and plant areas are easy to prop open and hard to keep track of.' },
    { icon: 'ri-calendar-event-line', title: 'Function and wedding nights', desc: 'Bigger celebrations mean more guests, longer hours and more to keep an eye on.' },
    { icon: 'ri-goblet-line', title: 'Licensed premises duty', desc: 'Where a function bar or event requires door supervision activity, that duty has to be covered.' },
    { icon: 'ri-moon-line', title: 'Overnight presence', desc: 'The building stays occupied after the front desk goes quiet, including car parks and grounds.' },
    { icon: 'ri-emotion-unhappy-line', title: 'Difficult guest situations', desc: 'A refusal, a disagreement or an uninvited visitor needs a calm, trained response.' },
    { icon: 'ri-user-unfollow-line', title: 'Gaps in regular cover', desc: 'Sickness, leave or a late cancellation can leave a shift without the officer you expected.' },
    { icon: 'ri-file-warning-line', title: 'Incidents with no record', desc: 'Without a written account it is difficult to follow up with a duty manager or the police.' },
  ],
  solutionsTitle: 'How QuickGuard works for a hotel',
  solutionsIntro:
    'A recorded availability check, a requirement posted inside your plan allowance, applicants you review, and a booking confirmed by payment.',
  solutions: [
    {
      icon: 'ri-calendar-check-line',
      title: 'Checked against recorded criteria',
      desc: 'A guest check counts guards whose recorded licence type, stated availability window, travel radius, venue preferences and listed minimum rate fit the shift. It is an indicator only, not a reservation.',
    },
    {
      icon: 'ri-building-2-line',
      title: 'Cover shift by shift',
      desc: 'Add presence for a function night, a festive period or an overnight stretch without taking on permanent headcount.',
    },
    {
      icon: 'ri-user-search-line',
      title: 'Profiles you review',
      desc: 'Compare experience, ratings and the licence details recorded on each profile before you choose who you want.',
    },
    {
      icon: 'ri-bank-card-line',
      title: 'Confirmed by payment',
      desc: 'Selecting guards is provisional. The shift is confirmed only after the card payment through Stripe succeeds, and the fee is separate from the agreed guard pay.',
    },
  ],
  rolesTitle: 'Hospitality roles and the licence each one needs',
  rolesIntro:
    'Licensing follows the activity, not the building. Describe the duties and the matching licence type can be requested.',
  roles: [
    { icon: 'ri-hotel-line', name: 'Reception and lobby presence', desc: 'A uniformed presence at the front of house. A concierge or guest service role is not licensable in itself; guarding activity is.' },
    { icon: 'ri-door-open-line', name: 'Door supervision at functions', desc: 'Where a function bar or event involves door supervision activity, an SIA Door Supervisor licence applies.' },
    { icon: 'ri-shield-user-line', name: 'Security guarding', desc: 'Manned guarding, patrolling and access control duties covered by an SIA Security Guarding licence.' },
    { icon: 'ri-eye-line', name: 'CCTV monitoring', desc: 'Public space surveillance work needs an SIA CCTV (PSS) licence. General building cameras may fall outside it.' },
    { icon: 'ri-vip-crown-line', name: 'Close protection', desc: 'Close protection duties for a principal are a separate licensed activity, not general venue security.' },
    { icon: 'ri-route-line', name: 'Patrol and out-of-hours officer', desc: 'Walking the building, function rooms and car park at agreed intervals through the night.' },
  ],
  featureMessage: 'Presence for the nights and functions that call for it.',
  featureSub: 'Check recorded availability, review the applicants, then confirm with payment.',
  featureImage: FEATURE_IMAGE,
  faqs: [
    {
      q: 'What does the availability check actually count?',
      a: 'Before you sign in you can run a guest check using the postcode, shift date and times, required licence type, venue type and the rate you intend to offer. It counts guards whose active, completed and approved profiles record that licence type, an availability window and day set covering the shift, an hourly rate at or below your offer, venue preferences that include the venue type you picked or are left open, a travel radius that reaches your postcode, and no clashing assignment.',
    },
    {
      q: 'Is a match a reservation of a guard?',
      a: 'No. It reflects records guards maintain and can change, so it is an indication only. Nothing is held, reserved or guaranteed, and guards still decide whether to apply and accept work.',
    },
    {
      q: 'Does checking availability post my job or contact anyone?',
      a: 'No. The check posts nothing and notifies no guard. To receive applications you sign in or create a client account, review your request and confirm the posting yourself.',
    },
    {
      q: 'Is there a limit on how many jobs I can post?',
      a: 'Yes, your client plan sets a monthly job posting allowance. Publishing a job within that allowance takes no booking payment; the booking payment happens later, when you have chosen guards.',
    },
    {
      q: 'Do guards pay to apply for hotel work?',
      a: 'No. Registration, browsing and applications are free for guards, with no paid membership, no paid tiers, no paid priority in applicant order and no application cap tied to a paid plan. A completed, approved profile and a valid SIA licence are still required where the duties are licensable.',
    },
    {
      q: 'When is a hotel booking confirmed?',
      a: 'Choosing guards leaves the booking provisional. It is confirmed only when the card payment through Stripe succeeds. Before that, the shift is not secured and the officer is not committed to your venue.',
    },
    {
      q: 'How is the booking service fee charged?',
      a: 'Your plan’s booking service fee is charged on top of the agreed gross guard pay, never deducted from it, and QuickGuard takes no booking commission on new guard bookings. The fee and any eligible promotion are shown before you confirm payment.',
    },
    {
      q: 'Can you cover a hotel shift tonight?',
      a: 'You can post a short-notice requirement at any time, but we do not promise same-day, instant or guaranteed cover. What comes back depends on which eligible guards apply and whether payment is completed in time.',
    },
    {
      q: 'Does reception or concierge work need an SIA licence?',
      a: 'Guest service, luggage, key handling and reception duties are not licensable in themselves. Where a role includes guarding, door supervision or public space surveillance activity, the licence for that activity is needed. Check current SIA guidance and your site risk assessment.',
    },
    {
      q: 'Does QuickGuard take over our premises licence duties?',
      a: 'No. QuickGuard helps you find security personnel. Conditions attached to a premises licence, guest safety arrangements, insurance and fire procedures stay with the venue and its responsible people.',
    },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your hotel requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function HotelSecurityRoute() {
  return (
    <>
      <IndustrySchema
        name="Hotel & Hospitality Security"
        slug="hotel-security"
        description="Check recorded guard availability for hotel and hospitality shifts, review the guards who apply, and confirm a booking after a successful Stripe payment. Availability checks reflect recorded matching criteria only and are not a reservation or a guarantee of cover."
      />
      <HotelSecurityPage data={data} />
    </>
  );
}