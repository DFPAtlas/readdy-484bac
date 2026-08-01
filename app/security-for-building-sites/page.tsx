import UseCasePage from '@/components/UseCasePage';
import type { Metadata } from 'next';
import UseCaseSchema from './UseCaseSchema';

export const metadata: Metadata = {
  title: 'Security for Construction Sites | Hire SIA Guards Overnight — QuickGuard',
  description: 'Hire SIA-licensed security guards for construction sites and building projects. Overnight patrol, site access control, equipment protection. Direct booking, no agency.',
  alternates: {
    canonical: 'https://quickguard.uk/security-for-building-sites',
  },
  openGraph: {
    title: 'Security for Construction Sites | QuickGuard',
    description: 'Hire SIA-licensed security guards for construction sites. Overnight patrol, equipment protection.',
    url: 'https://quickguard.uk/security-for-building-sites',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20high-visibility%20vest%20and%20formal%20uniform%20standing%20at%20the%20entrance%20of%20a%20large%20construction%20site%20at%20dusk%20with%20scaffolding%20and%20steel%20framework%20silhouetted%20against%20an%20orange%20and%20deep%20blue%20sunset%20sky%2C%20construction%20equipment%20and%20materials%20visible%20in%20soft%20focus%20background%2C%20dramatic%20cinematic%20lighting%20with%20warm%20golden%20hour%20tones%20on%20the%20left%20side%20transitioning%20to%20deep%20navy%20blue%20on%20the%20right%2C%20clean%20professional%20composition%20with%20ample%20negative%20space%20on%20the%20left%20for%20text%20overlay%2C%20modern%20commercial%20photography%20style%2C%20realistic%20sharp%20details%2C%20premium%20security%20industry%20aesthetic%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_construction_og_20260702&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — Construction Site Security Guards UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security for Construction Sites | QuickGuard',
    description: 'Hire SIA-licensed security guards for construction sites. Overnight patrol, equipment protection.',
    images: ['https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20high-visibility%20vest%20and%20formal%20uniform%20standing%20at%20the%20entrance%20of%20a%20large%20construction%20site%20at%20dusk%20with%20scaffolding%20and%20steel%20framework%20silhouetted%20against%20an%20orange%20and%20deep%20blue%20sunset%20sky%2C%20construction%20equipment%20and%20materials%20visible%20in%20soft%20focus%20background%2C%20dramatic%20cinematic%20lighting%20with%20warm%20golden%20hour%20tones%20on%20the%20left%20side%20transitioning%20to%20deep%20navy%20blue%20on%20the%20right%2C%20clean%20professional%20composition%20with%20ample%20negative%20space%20on%20the%20left%20for%20text%20overlay%2C%20modern%20commercial%20photography%20style%2C%20realistic%20sharp%20details%2C%20premium%20security%20industry%20aesthetic%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_construction_og_20260702&orientation=landscape'],
  },
};

const data = {
  slug: 'security-for-building-sites',
  title: 'Construction Site Security',
  headline: 'Construction Site Security — Overnight & Day Patrol',
  subheadline: 'Protect your building site, equipment, and materials with verified SIA guards. Book overnight security, access control, and perimeter patrol directly — no agency contracts needed.',
  heroImage: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20high-visibility%20vest%20and%20formal%20uniform%20standing%20at%20the%20entrance%20of%20a%20large%20construction%20site%20at%20dusk%20with%20scaffolding%20and%20steel%20framework%20silhouetted%20against%20an%20orange%20and%20deep%20blue%20sunset%20sky%2C%20construction%20equipment%20and%20materials%20visible%20in%20soft%20focus%20background%2C%20dramatic%20cinematic%20lighting%20with%20warm%20golden%20hour%20tones%20on%20the%20left%20side%20transitioning%20to%20deep%20navy%20blue%20on%20the%20right%2C%20clean%20professional%20composition%20with%20ample%20negative%20space%20on%20the%20left%20for%20text%20overlay%2C%20modern%20commercial%20photography%20style%2C%20realistic%20sharp%20details%2C%20premium%20security%20industry%20aesthetic%2C%20simple%20uncluttered%20background&width=1600&height=900&seq=qg_construction_hero_20260508&orientation=landscape',
  venueCategory: 'construction_site',
  ctaLabel: 'Hire Site Security',
  steps: [
    { icon: 'ri-file-list-line', title: 'Site Details', desc: 'Share your site address, hours, and whether you need patrol or static guarding.' },
    { icon: 'ri-user-search-line', title: 'Guards Match', desc: 'Guards with construction site experience and valid licences get notified.' },
    { icon: 'ri-shield-check-line', title: 'Review & Book', desc: 'Check guard profiles for site-specific experience. Confirm with one click.' },
    { icon: 'ri-lock-line', title: 'Pay on Completion', desc: 'Funds stay held with Stripe until you confirm the shift was completed as agreed.' },
  ],
  faqs: [
    { q: 'Can guards do mobile patrols around a large site?', a: 'Yes. Many guards have transport and are willing to patrol large perimeters. Check the "Has Own Transport" and "Willing to Travel" badges on their profile.' },
    { q: 'Do guards have CSCS cards or construction site experience?', a: 'Many do. Guards can list certifications and specialisations on their profile. You can also require specific qualifications in your job post.' },
    { q: 'Can I book a guard for an entire 12-hour night shift?', a: 'Yes. You control the start and end times. Guards apply based on their availability for the exact shift length you post.' },
    { q: 'What if my site is in a remote location?', a: 'Set your postcode when posting. Guards with transport and willingness to travel further will still see and apply to your job.' },
    { q: 'Is there insurance coverage?', a: 'All QuickGuard guards carry their own SIA-mandated public liability insurance. You should also maintain your own site insurance as standard practice.' },
  ],
  testimonialQuote: 'We manage three active sites in Birmingham. QuickGuard lets us book overnight security the same day a site goes live. The guards arrive with proper hi-vis, know the site protocols, and we have never had a tool theft since switching from our old agency.',
  testimonialAuthor: 'James R.',
  testimonialVenue: 'Site Manager, Birmingham',
};

export default function BuildingSiteSecurityPage() {
  return (
    <>
      <UseCaseSchema
        title="Construction Site Security"
        slug="security-for-building-sites"
        description="Hire SIA-licensed security guards for construction sites and building projects. Overnight patrol, site access control, equipment protection."
      />
      <UseCasePage data={data} />
    </>
  );
}