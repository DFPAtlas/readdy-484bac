import type { Metadata } from 'next';
import UseCaseSchema from './UseCaseSchema';
import BuildingSitesPage from './BuildingSitesPage';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20high-visibility%20vest%20and%20formal%20uniform%20standing%20at%20the%20entrance%20of%20a%20large%20construction%20site%20at%20dusk%20with%20scaffolding%20and%20steel%20framework%20silhouetted%20against%20an%20orange%20and%20deep%20blue%20sunset%20sky%2C%20construction%20equipment%20and%20materials%20visible%20in%20soft%20focus%20background%2C%20dramatic%20cinematic%20lighting%20with%20warm%20golden%20hour%20tones%20on%20the%20left%20side%20transitioning%20to%20deep%20navy%20blue%20on%20the%20right%2C%20clean%20professional%20composition%20with%20ample%20negative%20space%20on%20the%20left%20for%20text%20overlay%2C%20modern%20commercial%20photography%20style%2C%20realistic%20sharp%20details%2C%20premium%20security%20industry%20aesthetic%2C%20simple%20uncluttered%20background&width=1280&height=720&seq=qg_construction_hero_20260508&orientation=landscape';

const SOCIAL_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20high-visibility%20vest%20and%20formal%20uniform%20standing%20at%20the%20entrance%20of%20a%20large%20construction%20site%20at%20dusk%20with%20scaffolding%20and%20steel%20framework%20silhouetted%20against%20an%20orange%20and%20deep%20blue%20sunset%20sky%2C%20construction%20equipment%20and%20materials%20visible%20in%20soft%20focus%20background%2C%20dramatic%20cinematic%20lighting%20with%20warm%20golden%20hour%20tones%20on%20the%20left%20side%20transitioning%20to%20deep%20navy%20blue%20on%20the%20right%2C%20clean%20professional%20composition%20with%20ample%20negative%20space%20on%20the%20left%20for%20text%20overlay%2C%20modern%20commercial%20photography%20style%2C%20realistic%20sharp%20details%2C%20premium%20security%20industry%20aesthetic%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_construction_og_20260702&orientation=landscape';

const DESCRIPTION =
  'Check recorded guard availability for a building site shift, then sign in to review the guards who apply and confirm a booking after a successful card payment.';

export const metadata: Metadata = {
  title: 'Construction Site Security Guards for Building Sites',
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://quickguard.uk/security-for-building-sites',
  },
  openGraph: {
    title: 'Construction Site Security Guards for Building Sites',
    description: DESCRIPTION,
    url: 'https://quickguard.uk/security-for-building-sites',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Security officer at a UK building site entrance',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Construction Site Security Guards for Building Sites',
    description: DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

const FAQS = [
  {
    q: 'What does the availability check actually do?',
    a: 'Before you sign in you can run a guest check. It counts guards whose recorded availability, travel distance, listed minimum hourly rate and licence type match the shift details you enter. It reflects recorded criteria only — it does not hold, reserve or guarantee anyone, and guards still decide whether to accept work.',
  },
  {
    q: 'Does the check post my job or notify guards?',
    a: 'No. Nothing is posted and no guard is notified at the check stage. To receive applications you sign in or create a company account, review the requirement and confirm the posting yourself.',
  },
  {
    q: 'What happens when I post a site requirement?',
    a: 'Posting is subject to your client plan’s monthly job posting allowance. Posting on its own takes no payment, and no booking exists until you have chosen guards and paid.',
  },
  {
    q: 'Do guards pay to apply for building site work?',
    a: 'No. Applications are free for eligible guards, with no application cap and no paid membership, tiers or paid priority. Eligibility includes an active account, a completed and approved profile, and a valid SIA licence that matches the job’s licence requirement.',
  },
  {
    q: 'When is a site booking confirmed?',
    a: 'Choosing guards leaves the booking provisional. It is confirmed only when your card payment through Stripe succeeds. Until that payment completes, the shift is not secured and no officer is committed to your site.',
  },
  {
    q: 'How are booking fees and commission handled?',
    a: 'Your client plan’s booking service fee is charged on top of the agreed gross guard pay, never deducted from it, and no QuickGuard booking commission is deducted on new guard bookings. Payment is taken by card through Stripe when the booking is confirmed; we do not describe funds as held in escrow.',
  },
  {
    q: 'Can I get a guard on site today?',
    a: 'You can post a short-notice requirement at any time, but we do not promise same-day, instant or guaranteed cover, and we quote no staffing ratios or crime-reduction figures. What comes back depends on which eligible guards apply and whether you complete payment.',
  },
  {
    q: 'Does QuickGuard replace our site safety, insurance or accreditation responsibilities?',
    a: 'No. QuickGuard helps you find security personnel and does not take over site safety obligations, insurance, or any construction-specific accreditation. A recorded SIA licence is not insurance, and we do not claim every aspect of a guard’s history has been verified. Base the duties in each requirement on a site-specific risk assessment and check current SIA guidance.',
  },
];

export default function BuildingSiteSecurityPage() {
  return (
    <>
      <UseCaseSchema
        title="Construction Site Security for Building Sites"
        slug="security-for-building-sites"
        description={DESCRIPTION}
      />
      <BuildingSitesPage
        heroImage={HERO_IMAGE}
        headline="Building site security for active sites and compounds"
        subheadline="Check recorded guard availability for a shift, review the guards who apply, and confirm a booking once your payment succeeds."
        ctaLabel="Hire Site Security"
        faqs={FAQS}
      />
    </>
  );
}