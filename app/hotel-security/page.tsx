import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Hotel Security Staff for Events & Functions',
  description:
    'Find hotel security staff for weddings, conferences, functions and short-notice incidents. QuickGuard helps hotels and hospitality venues source licensed security when they need it.',
  keywords:
    'hotel security staff, hospitality security, wedding security, conference security, hotel door supervisors',
  alternates: {
    canonical: 'https://quickguard.uk/hotel-security',
  },
  openGraph: {
    title: 'Hotel Security Staff for Events & Functions | QuickGuard',
    description:
      'Find hotel security staff for weddings, conferences, functions and short-notice incidents.',
    url: 'https://quickguard.uk/hotel-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20officer%20in%20a%20smart%20dark%20suit%20standing%20discreetly%20in%20the%20elegant%20lobby%20of%20a%20luxury%20UK%20hotel%20with%20warm%20chandelier%20lighting%20and%20marble%20finishes%2C%20calm%20and%20attentive%20posture%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20golden%20highlights%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20hospitality%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_hotel_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — hotel security staff for hospitality venues',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hotel Security Staff for Events & Functions | QuickGuard',
    description:
      'Find hotel security staff for weddings, conferences, functions and short-notice incidents.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20officer%20in%20a%20smart%20dark%20suit%20standing%20discreetly%20in%20the%20elegant%20lobby%20of%20a%20luxury%20UK%20hotel%20with%20warm%20chandelier%20lighting%20and%20marble%20finishes%2C%20calm%20and%20attentive%20posture%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20golden%20highlights%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20hospitality%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_hotel_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'hotel-security',
  name: 'Hotels & Hospitality',
  eyebrow: 'Hospitality security cover',
  headline: 'Security when your venue needs it.',
  subheadline:
    'Find licensed security staff for hotels, weddings, conferences, functions and short-notice incidents.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20officer%20in%20a%20smart%20dark%20suit%20standing%20discreetly%20in%20the%20elegant%20lobby%20of%20a%20luxury%20UK%20hotel%20with%20warm%20chandelier%20lighting%20and%20marble%20finishes%2C%20calm%20and%20attentive%20posture%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20golden%20highlights%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20hospitality%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_hotel_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Find Hotel Security', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'Where hotels need extra security',
  problemsIntro:
    'Hospitality venues need discreet, professional cover for the events and moments that call for it.',
  problems: [
    { icon: 'ri-heart-line', title: 'Large weddings', desc: 'Bigger celebrations can need discreet guest management and door presence.' },
    { icon: 'ri-goblet-line', title: 'Christmas parties', desc: 'Festive functions bring higher volumes and a need for visible cover.' },
    { icon: 'ri-presentation-line', title: 'Conferences', desc: 'Large meetings and exhibitions may require access management and security.' },
    { icon: 'ri-vip-crown-line', title: 'VIP guests', desc: 'High-profile guests may need additional discretion and close protection.' },
    { icon: 'ri-boxing-line', title: 'Boxing or sporting functions', desc: 'Sporting events bring charged crowds and a greater need for cover.' },
    { icon: 'ri-emotion-unhappy-line', title: 'Difficult guests', desc: 'Occasional incidents need trained, calm handling to protect your venue.' },
    { icon: 'ri-moon-line', title: 'Night security', desc: 'Overnight cover for the building, car park or a specific event.' },
    { icon: 'ri-alert-line', title: 'Short-notice incidents', desc: 'Unexpected incidents can require security on site at very short notice.' },
  ],
  solutionsTitle: 'How QuickGuard supports your venue',
  solutionsIntro:
    'Add professional security for the nights and events that call for it, without permanent headcount.',
  solutions: [
    { icon: 'ri-calendar-event-line', title: 'Cover for events', desc: 'Arrange security for weddings, functions, conferences and parties.' },
    { icon: 'ri-user-search-line', title: 'Choose discreet professionals', desc: 'Review experience, ratings and licence information before confirming.' },
    { icon: 'ri-moon-line', title: 'Overnight and out-of-hours', desc: 'Cover the building, grounds or a specific function overnight.' },
    { icon: 'ri-flashlight-line', title: 'Short-notice support', desc: 'Find available operatives quickly when an incident requires cover.' },
  ],
  rolesTitle: 'Typical hospitality security roles',
  rolesIntro: 'The roles most often requested by hotels and hospitality venues.',
  roles: [
    { icon: 'ri-door-open-line', name: 'Door Supervisors', desc: 'Licensed door supervision for functions where that activity is required.' },
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General venue security, building and overnight cover.' },
    { icon: 'ri-vip-crown-line', name: 'Close Protection', desc: 'Close protection operatives for VIP or higher-risk assignments.' },
  ],
  useCases: {
    planned: [
      'Security for a booked wedding or function',
      'Planned cover across the festive party season',
      'Nightly security for a set period or event',
    ],
    shortNotice: [
      'Extra cover after guest numbers increase',
      'Cover arranged shortly before a function',
      'Backfill when a booked team member cancels',
    ],
    emergency: [
      'Immediate support after an incident on site',
      'Same-night cover for an unplanned function',
      'Rapid response to a difficult guest situation',
    ],
  },
  featureMessage: 'Add security for the nights and events that require it.',
  featureSub: 'Discreet, professional cover that fits around your venue and its guests.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Licensed%20door%20supervisor%20in%20a%20smart%20dark%20suit%20providing%20discreet%20security%20at%20an%20elegant%20UK%20hotel%20wedding%20reception%20with%20warm%20string%20lights%20and%20draped%20marquee%20fabric%20softly%20blurred%20behind%2C%20calm%20professional%20atmosphere%2C%20deep%20blue%20and%20teal%20tones%20with%20golden%20highlights%2C%20high-end%20hospitality%20photography%20style%2C%20sharp%20realistic%20detail&width=1600&height=900&seq=ind_hotel_feature_20261001&orientation=landscape',
  complianceNote:
    'Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence. Not every hospitality role is licensable.',
  faqs: [
    { q: 'Can I arrange security for a single event?', a: 'Yes. Post the details of your wedding, function or conference and available professionals can respond. There is no minimum commitment.' },
    { q: 'Do you provide overnight hotel security?', a: 'You can arrange cover for the specific nights you need, whether that is for the building, car park or a particular event.' },
    { q: 'Can security be discreet for guest-facing events?', a: 'Many hospitality professionals are experienced in discreet, guest-facing security. You can review profiles and experience before you confirm.' },
    { q: 'Will the operative be licensed?', a: 'Where the role involves licensable security activity, licence information is shown on the operative’s profile for you to review.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function HotelSecurityPage() {
  return (
    <>
      <IndustrySchema
        name="Hotel & Hospitality Security"
        slug="hotel-security"
        description="Licensed hotel security staff for weddings, conferences, functions and short-notice incidents."
      />
      <IndustryPage data={data} />
    </>
  );
}