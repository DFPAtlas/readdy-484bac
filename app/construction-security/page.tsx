import type { Metadata } from 'next';
import IndustryPage from '@/components/industry/IndustryPage';
import IndustrySchema from '@/components/industry/IndustrySchema';
import type { IndustryData } from '@/components/industry/types';

export const metadata: Metadata = {
  title: 'Construction Security Guards for Sites & Compounds',
  description:
    'Find construction security guards for sites, developments, compounds and infrastructure projects. QuickGuard helps you source licensed site security for theft, vandalism and plant protection.',
  keywords:
    'construction security guards, site security, construction site security, plant protection security, gatehouse security',
  alternates: {
    canonical: 'https://quickguard.uk/construction-security',
  },
  openGraph: {
    title: 'Construction Security Guards for Sites & Compounds | QuickGuard',
    description:
      'Find construction security guards for sites, developments, compounds and infrastructure projects.',
    url: 'https://quickguard.uk/construction-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20black%20uniform%20patrolling%20a%20UK%20construction%20site%20at%20dusk%20with%20scaffolding%2C%20cranes%20and%20stacked%20materials%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20site%20floodlight%20glow%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20industrial%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_construction_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — construction security guards for UK sites',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Construction Security Guards for Sites & Compounds | QuickGuard',
    description:
      'Find construction security guards for sites, developments, compounds and infrastructure projects.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20black%20uniform%20patrolling%20a%20UK%20construction%20site%20at%20dusk%20with%20scaffolding%2C%20cranes%20and%20stacked%20materials%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20site%20floodlight%20glow%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20industrial%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_construction_hero_20261001&orientation=landscape',
    ],
  },
};

const data: IndustryData = {
  slug: 'construction-security',
  name: 'Construction',
  eyebrow: 'Site security cover',
  headline: 'Protect your site when you need security most.',
  subheadline:
    'Find licensed security guards for construction sites, developments, compounds and infrastructure projects.',
  heroImage:
    'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20black%20uniform%20patrolling%20a%20UK%20construction%20site%20at%20dusk%20with%20scaffolding%2C%20cranes%20and%20stacked%20materials%20in%20the%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20site%20floodlight%20glow%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20industrial%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_construction_hero_20261001&orientation=landscape',
  primaryCta: { label: 'Find Site Security', href: '/client/register?redirect=/post-job' },
  secondaryCta: { label: 'Create Company Account', href: '/client/register' },
  problemsTitle: 'What site security needs to prevent',
  problemsIntro:
    'Construction sites are vulnerable to loss and disruption, especially out of hours. These are the requirements QuickGuard helps you cover.',
  problems: [
    { icon: 'ri-hand-coin-line', title: 'Theft prevention', desc: 'Deter and detect theft of tools, materials and equipment from site.' },
    { icon: 'ri-hammer-line', title: 'Vandalism', desc: 'Discourage damage that costs time and money to put right.' },
    { icon: 'ri-truck-line', title: 'Plant and equipment protection', desc: 'Protect high-value plant from removal or damage overnight.' },
    { icon: 'ri-archive-2-line', title: 'Material theft', desc: 'Reduce losses of materials that are targeted on active sites.' },
    { icon: 'ri-home-office-line', title: 'Vacant sites', desc: 'Cover sites that are temporarily unoccupied or paused.' },
    { icon: 'ri-pause-circle-line', title: 'Temporary shutdowns', desc: 'Provide security through holiday breaks and short shutdowns.' },
    { icon: 'ri-door-lock-line', title: 'Gatehouse cover', desc: 'Manned access control for deliveries, contractors and vehicles.' },
    { icon: 'ri-user-unfollow-line', title: 'Existing guard absence', desc: 'Backfill when your regular site officer is unavailable.' },
  ],
  solutionsTitle: 'How QuickGuard secures your site',
  solutionsIntro:
    'Source licensed site security for a shift, a weekend or an extended period — without permanent commitments.',
  solutions: [
    { icon: 'ri-moon-line', title: 'Out-of-hours cover', desc: 'Arrange nightly and weekend patrols when the site is quiet.' },
    { icon: 'ri-user-search-line', title: 'Choose your officer', desc: 'Review experience, ratings and licence information before confirming.' },
    { icon: 'ri-calendar-2-line', title: 'Flexible durations', desc: 'Cover a shutdown, a phase of works or a short gap — as needed.' },
    { icon: 'ri-flashlight-line', title: 'Short-notice backfill', desc: 'Fill a gap quickly when your regular guard is absent.' },
  ],
  rolesTitle: 'Typical construction security roles',
  rolesIntro: 'The site security roles most often requested across construction projects.',
  roles: [
    { icon: 'ri-shield-user-line', name: 'Security Guards', desc: 'General site security, patrols and out-of-hours presence.' },
    { icon: 'ri-door-lock-line', name: 'Gatehouse Security', desc: 'Manned access control for deliveries, contractors and visitors.' },
    { icon: 'ri-roadster-line', name: 'Site Patrol Roles', desc: 'Foot or vehicle patrols suited to the layout of the site.' },
  ],
  useCases: {
    planned: [
      'Nightly cover during a phase of works',
      'Planned security through a holiday shutdown',
      'Ongoing out-of-hours protection across a development',
    ],
    shortNotice: [
      'Backfill for an absent regular site officer',
      'Extra cover after an attempted theft',
      'Short-term cover for a newly opened compound',
    ],
    emergency: [
      'Immediate cover after an overnight incident',
      'Same-day backfill to keep the gatehouse manned',
      'Rapid support to protect plant and materials',
    ],
  },
  featureMessage: 'Temporary security without committing to unnecessary permanent staffing.',
  featureSub: 'Scale site cover up or down as the project moves through its phases.',
  featureImage:
    'https://readdy.ai/api/search-image?query=Security%20guard%20in%20high-visibility%20black%20uniform%20standing%20beside%20a%20site%20gatehouse%20and%20protective%20fencing%20at%20a%20UK%20construction%20compound%2C%20plant%20machinery%20and%20steel%20frames%20softly%20blurred%20behind%2C%20cold%20blue%20evening%20tones%20with%20warm%20floodlight%20accents%2C%20documentary%20industrial%20photography%20style%2C%20sharp%20realistic%20details&width=1600&height=900&seq=ind_construction_feature_20261001&orientation=landscape',
  complianceNote:
    'Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence. Licence information is shown on profiles for you to review.',
  faqs: [
    { q: 'Can I arrange overnight site security?', a: 'Yes. Post the cover you need, including nightly or weekend shifts when the site is quiet, and available operatives can respond.' },
    { q: 'Do I need permanent security for my site?', a: 'No. QuickGuard lets you arrange cover for the periods you need it, such as shutdowns, high-risk phases or a short gap, without permanent staffing.' },
    { q: 'How quickly can site cover be arranged?', a: 'Many requirements receive responses within minutes. Mark a request as urgent if you need same-day backfill.' },
    { q: 'Will the guard be licensed?', a: 'Where the role involves licensable security activity, licence information is displayed on the operative’s profile so you can review it before confirming.' },
  ],
  relatedLinks: [
    { label: 'Create a company account', href: '/client/register' },
    { label: 'Post your site requirement', href: '/post-job' },
    { label: 'Browse available guards', href: '/find-a-guard' },
    { label: 'How QuickGuard works', href: '/how-it-works' },
    { label: 'View pricing', href: '/pricing' },
  ],
};

export default function ConstructionSecurityPage() {
  return (
    <>
      <IndustrySchema
        name="Construction Site Security"
        slug="construction-security"
        description="Licensed construction security guards for sites, compounds and infrastructure projects."
      />
      <IndustryPage data={data} />
    </>
  );
}