import type { Metadata } from 'next';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';
import ConstructionSecurityPage from './ConstructionSecurityPage';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=SIA-licensed%20security%20officer%20in%20black%20uniform%20and%20high-visibility%20vest%20walking%20a%20night%20patrol%20through%20an%20active%20UK%20construction%20site%2C%20tall%20tower%20crane%20and%20steel%20frame%20skeleton%20of%20a%20half-built%20building%20rising%20behind%20him%2C%20stacked%20timber%20and%20scaffolding%20materials%20in%20the%20foreground%2C%20portable%20site%20cabins%20and%20chain-link%20hoarding%2C%20warm%20amber%20floodlights%20cutting%20through%20cool%20blue%20evening%20mist%2C%20cinematic%20wide%20angle%20composition%20with%20the%20guard%20on%20the%20right%20and%20a%20smooth%20dark%20shadowed%20area%20across%20the%20whole%20left%20half%20of%20the%20frame%20for%20white%20headline%20text%2C%20gritty%20realistic%20industrial%20documentary%20photography%2C%20crisp%20detail&width=1600&height=900&seq=construction_site_guard_night_20261118&orientation=landscape';

const SOCIAL_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20black%20uniform%20patrolling%20a%20UK%20construction%20site%20at%20dusk%20with%20scaffolding%2C%20cranes%20and%20stacked%20materials%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20site%20floodlight%20glow%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20industrial%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_construction_hero_20261001&orientation=landscape';

export const metadata: Metadata = {
  title: 'Construction Site Security Guards',
  description:
    'Post a construction site security requirement for a site, compound or development. Check recorded guard availability, sign in to review the guards who apply, and confirm a booking after a successful Stripe payment.',
  keywords:
    'construction site security, construction security guards, gatehouse security, compound security, site patrol officers',
  alternates: {
    canonical: 'https://quickguard.uk/construction-security',
  },
  openGraph: {
    title: 'Construction Site Security Guards | QuickGuard',
    description:
      'Check recorded guard availability for a construction shift, review the guards who apply, and confirm a booking once payment succeeds.',
    url: 'https://quickguard.uk/construction-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: 'QuickGuard — construction site security requirements',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Construction Site Security Guards | QuickGuard',
    description:
      'Check recorded guard availability for a construction shift, review the guards who apply, and confirm a booking once payment succeeds.',
    images: [SOCIAL_IMAGE],
  },
};

const data: Omit<IndustryData, 'useCases' | 'complianceNote'> = {
  slug: 'construction-security',
  name: 'Construction',
  eyebrow: 'Construction site security',
  headline: 'Site security for active sites, compounds and developments.',
  subheadline:
    'Check recorded guard availability for a shift, review the guards who apply, and confirm a booking once your payment succeeds.',
  heroImage: HERO_IMAGE,
  primaryCta: { label: 'Post a Site Requirement', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'Where construction sites lose time and material',
  problemsIntro:
    'Out-of-hours loss, damaged plant and an unmanaged gate all cost a programme time. These are the gaps site security is usually asked to cover.',
  problems: [
    { icon: 'ri-hand-coin-line', title: 'Tool and material theft', desc: 'Tools, fixings and stacked materials are targeted on sites that are quiet overnight.' },
    { icon: 'ri-truck-line', title: 'Plant and equipment', desc: 'Plant left on site between shifts needs watching, along with fuel and attachments.' },
    { icon: 'ri-hammer-line', title: 'Vandalism and damage', desc: 'Deliberate damage to works, cabins or hoarding costs time to put right.' },
    { icon: 'ri-door-lock-line', title: 'Unmanaged gates', desc: 'An unattended gate means deliveries, contractors and vehicles go unrecorded.' },
    { icon: 'ri-home-office-line', title: 'Vacant or paused sites', desc: 'Sites that are paused, between phases or awaiting handover sit unused and exposed.' },
    { icon: 'ri-pause-circle-line', title: 'Shutdown periods', desc: 'Holiday breaks and short shutdowns leave a site standing with nobody on it.' },
    { icon: 'ri-user-unfollow-line', title: 'Regular officer absence', desc: 'Sickness or leave can leave a gatehouse unmanned with little notice.' },
    { icon: 'ri-file-warning-line', title: 'Unrecorded incidents', desc: 'Without a written account of an incident, it is harder to follow up afterwards.' },
  ],
  solutionsTitle: 'How QuickGuard works for a construction site',
  solutionsIntro:
    'A recorded availability check, a requirement posted within your plan allowance, applicants you review, and a booking confirmed only by payment.',
  solutions: [
    {
      icon: 'ri-calendar-check-line',
      title: 'Recorded availability check',
      desc: 'A guest check counts guards whose recorded availability, travel radius, listed minimum rate and licence type match the shift. It is an indicator only — not a reservation or a guarantee of cover.',
    },
    {
      icon: 'ri-file-list-3-line',
      title: 'Post within your allowance',
      desc: 'Sign in or create a company account, then post the requirement. Posting is subject to your client plan’s monthly job posting allowance and takes no payment.',
    },
    {
      icon: 'ri-user-search-line',
      title: 'Review the applicants',
      desc: 'Eligible guards can apply at no cost, with no paid membership, tiers or paid priority. Compare profiles, experience, ratings and the licence information shown before choosing.',
    },
    {
      icon: 'ri-bank-card-line',
      title: 'Payment confirms the booking',
      desc: 'Your selection stays provisional until the card payment through Stripe succeeds. Your plan’s booking service fee is separate from the agreed gross guard pay.',
    },
  ],
  rolesTitle: 'Typical construction security roles',
  rolesIntro:
    'Describe the duties in the requirement so the licence type and experience can be matched to the shift.',
  roles: [
    { icon: 'ri-shield-user-line', name: 'Site security officers', desc: 'General site security, patrolling the hoarding line and compound, and out-of-hours presence.' },
    { icon: 'ri-door-lock-line', name: 'Gatehouse and access control', desc: 'Manned gate, contractor and visitor sign-in, delivery booking and vehicle logging.' },
    { icon: 'ri-building-4-line', name: 'Static compound officers', desc: 'A fixed presence at a compound, plant yard or materials store through a shift.' },
  ],
  featureMessage: 'Site security cover for each phase of the works.',
  featureSub: 'Check recorded availability, review the applicants, then confirm with payment.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Security%20guard%20in%20high-visibility%20black%20uniform%20standing%20beside%20a%20site%20gatehouse%20and%20protective%20fencing%20at%20a%20UK%20construction%20compound%2C%20plant%20machinery%20and%20steel%20frames%20softly%20blurred%20behind%2C%20cold%20blue%20evening%20tones%20with%20warm%20floodlight%20accents%2C%20documentary%20industrial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_construction_feature_20261001&orientation=landscape',
  faqs: [
    {
      q: 'What does the availability check actually do?',
      a: 'Before you sign in you can run a guest check. It counts guards whose recorded availability, travel radius, listed minimum hourly rate and licence type match the shift details you enter. It reflects recorded availability only — it does not hold, reserve or guarantee anyone, and availability can change.',
    },
    {
      q: 'Does the check post my job or notify guards?',
      a: 'No. Nothing is posted and no guard is notified at the check stage. To receive applications you sign in or create a company account, then post the requirement yourself and review what comes back.',
    },
    {
      q: 'What happens when I post a site requirement?',
      a: 'Posting is subject to your client plan’s monthly job posting allowance. Posting on its own takes no payment, and no booking exists until you have chosen guards and paid.',
    },
    {
      q: 'Do guards pay to apply for construction work?',
      a: 'No. Applications are free for eligible guards and there is no monthly application cap. Eligibility includes an active account, a completed and approved profile, and a valid SIA licence that matches the job’s licence requirement.',
    },
    {
      q: 'When is a site booking confirmed?',
      a: 'Choosing guards leaves the booking provisional. It is confirmed only when your card payment through Stripe succeeds. Until that payment completes, the shift is not secured and no officer is committed to your site.',
    },
    {
      q: 'Is there a booking commission or escrow?',
      a: 'Your client plan’s booking service fee is charged on top of the agreed gross guard pay, never deducted from it, and QuickGuard takes no booking commission on new guard bookings. Payment is taken by card through Stripe when the booking is confirmed; there is no escrow.',
    },
    {
      q: 'Can I get a guard on site today?',
      a: 'You can post a short-notice requirement at any time, but we do not promise same-day, instant or guaranteed cover. What comes back depends on which eligible guards apply and whether you complete payment.',
    },
    {
      q: 'Does QuickGuard replace our site safety or insurance arrangements?',
      a: 'No. QuickGuard helps you find security personnel and does not take over site safety obligations, insurance, or any construction-specific accreditation. Base the duties in each requirement on a site-specific risk assessment and check current SIA guidance.',
    },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your site requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function ConstructionSecurityRoute() {
  return (
    <>
      <IndustrySchema
        name="Construction Site Security"
        slug="construction-security"
        description="Post construction site security requirements for sites, compounds and developments. Availability checks reflect recorded guard matching criteria only, and a booking is confirmed after a successful Stripe payment."
      />
      <ConstructionSecurityPage data={data} />
    </>
  );
}