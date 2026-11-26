import type { Metadata } from 'next';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';
import RetailSecurityPage from './RetailSecurityPage';

const HERO_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20retail%20security%20guard%20in%20formal%20black%20uniform%20standing%20attentively%20near%20the%20entrance%20of%20a%20bright%20modern%20UK%20high%20street%20store%20with%20polished%20floors%20and%20product%20displays%2C%20natural%20daylight%20through%20large%20glass%20windows%2C%20clean%20minimalist%20interior%20with%20neutral%20tones%20and%20subtle%20teal%20accents%2C%20cinematic%20composition%20with%20a%20clean%20soft%20gradient%20across%20the%20left%20side%20for%20text%20overlay%2C%20premium%20commercial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_retail_hero_20261001&orientation=landscape';

const SOCIAL_IMAGE =
  'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20retail%20security%20guard%20in%20formal%20black%20uniform%20standing%20attentively%20near%20the%20entrance%20of%20a%20bright%20modern%20UK%20high%20street%20store%20with%20polished%20floors%20and%20product%20displays%2C%20natural%20daylight%20through%20large%20glass%20windows%2C%20clean%20minimalist%20interior%20with%20neutral%20tones%20and%20subtle%20teal%20accents%2C%20cinematic%20composition%20with%20a%20clean%20soft%20gradient%20across%20the%20left%20side%20for%20text%20overlay%2C%20premium%20commercial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_retail_hero_20261001&orientation=landscape';

const FEATURE_IMAGE =
  'https://readdy.ai/api/search-image?query=Retail%20security%20officer%20in%20black%20uniform%20walking%20the%20shop%20floor%20of%20a%20busy%20modern%20UK%20department%20store%20during%20a%20sale%2C%20shoppers%20and%20stocked%20shelves%20softly%20blurred%20in%20the%20background%2C%20bright%20natural%20lighting%20with%20subtle%20teal%20accents%2C%20professional%20commercial%20photography%20style%2C%20sharp%20realistic%20detail&width=1600&height=900&seq=ind_retail_feature_20261001&orientation=landscape';

export const metadata: Metadata = {
  title: 'Retail Security Guards for Store Cover',
  description:
    'Check recorded guard availability for a retail shift, post the requirement within your client plan allowance, review the guards who apply and confirm a booking once Stripe payment succeeds.',
  keywords:
    'retail security guards, store security cover, retail security staffing, SIA licensed security guards, retail loss prevention duties',
  alternates: {
    canonical: 'https://quickguard.uk/retail-security',
  },
  openGraph: {
    title: 'Retail Security Guards for Store Cover | QuickGuard',
    description:
      'Recorded availability checks for store shifts, free guard applications, provisional selection and a booking confirmed only after Stripe payment.',
    url: 'https://quickguard.uk/retail-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: 'QuickGuard — retail security guards for UK stores',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retail Security Guards for Store Cover | QuickGuard',
    description:
      'Check recorded guard availability for a store shift, review the guards who apply, and confirm a booking after a successful Stripe payment.',
    images: [SOCIAL_IMAGE],
  },
};

const data: Omit<IndustryData, 'useCases' | 'complianceNote'> = {
  slug: 'retail-security',
  name: 'Retail',
  eyebrow: 'Retail security cover',
  headline: 'Security cover for your store, shift by shift.',
  subheadline:
    'Check which guards’ recorded availability matches your store shift, post the requirement within your plan allowance, then review the applicants and confirm with payment.',
  heroImage: HERO_IMAGE,
  primaryCta: { label: 'Find Retail Security', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'When stores look for extra cover',
  problemsIntro:
    'Retail rotas break at short notice. These are the situations a store requirement usually describes.',
  problems: [
    { icon: 'ri-user-unfollow-line', title: 'Guard sickness', desc: 'An unexpected absence leaves the shop floor without the presence you planned for.' },
    { icon: 'ri-close-circle-line', title: 'Late cancellation', desc: 'A cancelled shift leaves a gap that has to be filled before opening.' },
    { icon: 'ri-shopping-bag-3-line', title: 'Christmas trading', desc: 'The busiest trading weeks need more visible presence than a normal rota provides.' },
    { icon: 'ri-price-tag-3-line', title: 'Sale events', desc: 'Black Friday and clearance weekends bring larger crowds and longer queues.' },
    { icon: 'ri-store-2-line', title: 'Store openings', desc: 'A new, refitted or relaunched store may need cover during the opening period.' },
    { icon: 'ri-truck-line', title: 'Deliveries and stock movements', desc: 'Back-door deliveries and stock transfers may need someone watching the yard or loading bay.' },
    { icon: 'ri-emotion-unhappy-line', title: 'Local anti-social behaviour', desc: 'Problems around the entrance can call for a visible presence at the door.' },
    { icon: 'ri-file-list-3-line', title: 'Contract gaps', desc: 'Cover the period while a longer-term arrangement is being arranged.' },
  ],
  solutionsTitle: 'How a retail requirement works',
  solutionsIntro:
    'A recorded availability check, a posting inside your allowance, applicants you review, and a booking confirmed only by payment.',
  solutions: [
    {
      icon: 'ri-calendar-check-line',
      title: 'Recorded availability check',
      desc: 'A guest check counts guards whose recorded availability, travel radius, listed minimum rate and licence type match the shift. It reserves nobody and guarantees no cover.',
    },
    {
      icon: 'ri-file-list-3-line',
      title: 'Post within your allowance',
      desc: 'Sign in or create a company account, then review and confirm the posting. Your plan sets the monthly job posting allowance and posting takes no payment.',
    },
    {
      icon: 'ri-user-search-line',
      title: 'Review the applicants',
      desc: 'Eligible guards apply free, with no paid membership, tiers or paid priority. Compare profiles, ratings and the licence information shown.',
    },
    {
      icon: 'ri-bank-card-line',
      title: 'Payment confirms the booking',
      desc: 'Your selection stays provisional until the card payment through Stripe succeeds. Your plan’s booking fee is charged on top of the agreed guard pay.',
    },
  ],
  rolesTitle: 'Roles usually requested by retailers',
  rolesIntro:
    'The licence follows the duties, not the job title. Describe the work in the requirement so the right licence can be matched.',
  roles: [
    {
      icon: 'ri-shield-user-line',
      name: 'Retail security officers',
      desc: 'Shop-floor presence, entrance cover and patrols. Where the duties are licensable guarding, an SIA Security Guarding licence applies.',
    },
    {
      icon: 'ri-search-eye-line',
      name: 'Loss prevention duties',
      desc: 'Watching the floor, noting suspicious behaviour and following your store procedures. Loss prevention is a set of duties, not a separate SIA licence category.',
    },
    {
      icon: 'ri-door-open-line',
      name: 'Door supervision duties',
      desc: 'Where the work amounts to door supervision, an SIA Door Supervisor licence is the matching one. Decide this from the duties, not the site type.',
    },
    {
      icon: 'ri-camera-line',
      name: 'CCTV monitoring',
      desc: 'Monitoring cameras that counts as public space surveillance needs an SIA CCTV (PSS) licence. Not every in-store camera check is a PSS activity.',
    },
    {
      icon: 'ri-team-line',
      name: 'Supervisors',
      desc: 'A lead officer for multi-site or larger rotas, working under the same licence rules as the duties they carry out.',
    },
  ],
  example: {
    title: 'An example store requirement',
    subtitle: 'These are the details you would enter when posting a shift.',
    rows: [
      { label: 'Store postcode', value: 'Your store postcode' },
      { label: 'Licence required', value: 'Matched to the duties you describe' },
      { label: 'Date', value: 'The day you need cover' },
      { label: 'Start and finish', value: 'Your trading or delivery hours' },
      { label: 'Number required', value: 'How many operatives you need' },
      { label: 'Hourly rate', value: 'The agreed gross guard pay you set' },
      { label: 'Booking fee', value: 'Your plan’s fee, added on top and shown before payment' },
    ],
    note: 'Illustrative only. Availability is counted from guards’ recorded details and can change, so a check is not a reservation. The booking is confirmed only after a successful Stripe payment.',
  },
  featureMessage: 'Flexible retail cover that fits your trading calendar.',
  featureSub: 'Check recorded availability, review the applicants, then confirm with payment.',
  featureImage: FEATURE_IMAGE,
  faqs: [
    {
      q: 'What does the retail availability check actually do?',
      a: 'Before you sign in you can run a guest check. It counts guards whose recorded availability, travel radius, listed minimum hourly rate, venue preferences and licence type match the shift you describe. It reflects recorded details only, it does not hold or reserve anyone, and availability can change at any time.',
    },
    {
      q: 'Does the check post my requirement or notify guards?',
      a: 'No. Nothing is posted and no guard is notified at the check stage. To receive applications you sign in or create a company account, review the requirement, and confirm the posting yourself.',
    },
    {
      q: 'What happens when I post a store requirement?',
      a: 'Posting is subject to your client plan’s monthly job posting allowance. Posting on its own takes no payment and creates no confirmed booking. Eligible guards are then notified of the job and can apply.',
    },
    {
      q: 'Do guards pay to apply for retail work?',
      a: 'No. Guard registration, job browsing and applications are free, with no paid membership, no job tiers, no paid priority and no monthly application cap. Eligibility still requires an approved account with a valid SIA licence where the role is licensable.',
    },
    {
      q: 'When is the booking actually confirmed?',
      a: 'Choosing guards leaves the selection provisional. The booking is confirmed only when your card payment through Stripe succeeds. Until that payment completes, the shift is not secured and the guard is not committed.',
    },
    {
      q: 'How is the client booking fee charged?',
      a: 'Your plan’s booking service fee is calculated on the agreed gross guard pay and added on top of it, never deducted from it. QuickGuard takes no booking commission out of guard pay on new bookings, there is no escrow, and the fee plus any eligible promotion is shown before you pay.',
    },
    {
      q: 'Do all retail security roles need an SIA licence?',
      a: 'No. Licensing depends on the activity. Where duties amount to security guarding, door supervision or public space surveillance CCTV, the matching SIA licence applies. Greeting customers, queue help, directions and general shop-floor assistance are customer service, not licensable activity. Check current SIA guidance for your own duties.',
    },
    {
      q: 'Can QuickGuard guarantee loss prevention results or cover for a date?',
      a: 'No. We do not promise reduced shrinkage, fewer incidents, a guaranteed officer or cover for a specific date. Short-notice requirements can be posted, but what comes back depends on which eligible guards apply and whether payment completes in time.',
    },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your store requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function RetailSecurityRoute() {
  return (
    <>
      <IndustrySchema
        name="Retail Security Cover"
        slug="retail-security"
        description="Retail security cover for stores. Availability checks reflect recorded guard criteria only, guard applications are free, selection is provisional and a booking is confirmed after a successful Stripe payment."
      />
      <RetailSecurityPage data={data} />
    </>
  );
}