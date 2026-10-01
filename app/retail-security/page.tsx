import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Retail Security Guards for Temporary Store Cover',
  description:
    'Find retail security guards for temporary cover, busy trading periods and unexpected shortages. QuickGuard helps stores source licensed retail security staff across the UK.',
  keywords:
    'retail security guards, retail security staff, shop security, store security cover, loss prevention guards',
  alternates: {
    canonical: 'https://quickguard.uk/retail-security',
  },
  openGraph: {
    title: 'Retail Security Guards for Temporary Store Cover | QuickGuard',
    description:
      'Find retail security guards for temporary cover, busy trading periods and unexpected shortages.',
    url: 'https://quickguard.uk/retail-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20retail%20security%20guard%20in%20formal%20black%20uniform%20standing%20attentively%20near%20the%20entrance%20of%20a%20bright%20modern%20UK%20high%20street%20store%20with%20polished%20floors%20and%20product%20displays%2C%20natural%20daylight%20through%20large%20glass%20windows%2C%20clean%20minimalist%20interior%20with%20neutral%20tones%20and%20subtle%20teal%20accents%2C%20cinematic%20composition%20with%20a%20clean%20soft%20gradient%20across%20the%20left%20side%20for%20text%20overlay%2C%20premium%20commercial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_retail_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — retail security guards for UK stores',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retail Security Guards for Temporary Store Cover | QuickGuard',
    description:
      'Find retail security guards for temporary cover, busy trading periods and unexpected shortages.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20retail%20security%20guard%20in%20formal%20black%20uniform%20standing%20attentively%20near%20the%20entrance%20of%20a%20bright%20modern%20UK%20high%20street%20store%20with%20polished%20floors%20and%20product%20displays%2C%20natural%20daylight%20through%20large%20glass%20windows%2C%20clean%20minimalist%20interior%20with%20neutral%20tones%20and%20subtle%20teal%20accents%2C%20cinematic%20composition%20with%20a%20clean%20soft%20gradient%20across%20the%20left%20side%20for%20text%20overlay%2C%20premium%20commercial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_retail_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'retail-security',
  name: 'Retail',
  eyebrow: 'Retail security cover',
  headline: 'Add security cover when your store needs extra protection.',
  subheadline:
    'Find licensed retail security professionals for temporary cover, busy trading periods and unexpected staffing shortages.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20retail%20security%20guard%20in%20formal%20black%20uniform%20standing%20attentively%20near%20the%20entrance%20of%20a%20bright%20modern%20UK%20high%20street%20store%20with%20polished%20floors%20and%20product%20displays%2C%20natural%20daylight%20through%20large%20glass%20windows%2C%20clean%20minimalist%20interior%20with%20neutral%20tones%20and%20subtle%20teal%20accents%2C%20cinematic%20composition%20with%20a%20clean%20soft%20gradient%20across%20the%20left%20side%20for%20text%20overlay%2C%20premium%20commercial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_retail_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Find Retail Security', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'When stores need extra security',
  problemsIntro:
    'Retailers need flexible cover for peak periods and unexpected gaps. These are the requirements QuickGuard helps you meet.',
  problems: [
    { icon: 'ri-user-unfollow-line', title: 'Guard sickness', desc: 'A sudden absence leaves the shop floor short on cover.' },
    { icon: 'ri-alert-line', title: 'High-theft periods', desc: 'Certain periods bring a marked rise in loss and anti-social behaviour.' },
    { icon: 'ri-shopping-bag-3-line', title: 'Christmas', desc: 'The busiest trading weeks need more visible security presence.' },
    { icon: 'ri-price-tag-3-line', title: 'Black Friday', desc: 'Major sale events bring crowds and a higher risk of incidents.' },
    { icon: 'ri-store-2-line', title: 'Store openings', desc: 'New or refurbished stores may need extra cover during launch.' },
    { icon: 'ri-truck-line', title: 'High-value deliveries', desc: 'Protect deliveries and stock around high-value drop-offs.' },
    { icon: 'ri-emotion-unhappy-line', title: 'Increased anti-social behaviour', desc: 'Local issues can call for an increased security presence.' },
    { icon: 'ri-file-list-3-line', title: 'Temporary contract gaps', desc: 'Cover the period while a longer-term arrangement is arranged.' },
  ],
  solutionsTitle: 'How QuickGuard covers your store',
  solutionsIntro:
    'Increase security capacity for the periods you need it, without permanent additions to headcount.',
  solutions: [
    { icon: 'ri-calendar-2-line', title: 'Cover by the shift', desc: 'Book cover for a single day, a peak weekend or a busy season.' },
    { icon: 'ri-user-search-line', title: 'Choose your guard', desc: 'Review experience, ratings and licence information before confirming.' },
    { icon: 'ri-flashlight-line', title: 'Short-notice backfill', desc: 'Fill a gap quickly when a regular guard is unavailable.' },
    { icon: 'ri-shield-check-line', title: 'Licence information shown', desc: 'Where the role is licensable, licence details are shown on profiles.' },
  ],
  rolesTitle: 'Typical retail security roles',
  rolesIntro: 'The roles most often requested by shops, stores and retail chains.',
  roles: [
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General store security, door presence and floor coverage.' },
    { icon: 'ri-store-2-line', name: 'Retail Security', desc: 'Retail-focused roles covering loss prevention and store presence.' },
    { icon: 'ri-team-line', name: 'Supervisors', desc: 'Supervisors to lead security across larger or multi-site stores.' },
  ],
  useCases: {
    planned: [
      'Extra cover across the Christmas trading period',
      'Security planned for a store opening or refit',
      'Rostered weekend cover in a high-footfall store',
    ],
    shortNotice: [
      'Cover while a regular guard is on holiday',
      'Extra presence after a rise in theft',
      'Backfill for a cancelled shift',
    ],
    emergency: [
      'Same-day cover when a guard calls in sick',
      'Immediate support after an incident in store',
      'Rapid backfill during a peak trading day',
    ],
  },
  featureMessage: 'Increase security capacity without permanently increasing headcount.',
  featureSub: 'Flexible retail cover that scales with your trading calendar.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Retail%20security%20officer%20in%20black%20uniform%20walking%20the%20shop%20floor%20of%20a%20busy%20modern%20UK%20department%20store%20during%20a%20sale%2C%20shoppers%20and%20stocked%20shelves%20softly%20blurred%20in%20the%20background%2C%20bright%20natural%20lighting%20with%20subtle%20teal%20accents%2C%20professional%20commercial%20photography%20style%2C%20sharp%20realistic%20detail&width=1600&height=900&seq=ind_retail_feature_20261001&orientation=landscape',
  complianceNote:
    'Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence. Licence information is shown on profiles for you to review.',
  faqs: [
    { q: 'Can I get retail cover at short notice?', a: 'Yes. Mark your requirement as urgent and available operatives can respond quickly when you need same-day cover.' },
    { q: 'Can I book the same guard again?', a: 'You can review profiles and experience before confirming each booking, so you can choose operatives who suit your store.' },
    { q: 'Do I need a long-term contract?', a: 'No. QuickGuard lets you arrange cover for the shifts or periods you need, including peak trading seasons, without a long-term contract.' },
    { q: 'Will the guard be licensed?', a: 'Where the role involves licensable security activity, licence information is displayed on the operative’s profile for you to review.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your store requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function RetailSecurityPage() {
  return (
    <>
      <IndustrySchema
        name="Retail Security Cover"
        slug="retail-security"
        description="Licensed retail security guards for temporary cover, busy trading periods and staffing shortages."
      />
      <IndustryPage data={data} />
    </>
  );
}