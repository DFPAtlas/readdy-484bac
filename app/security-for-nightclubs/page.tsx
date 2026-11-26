import UseCasePage from '@/components/UseCasePage';
import type { Metadata } from 'next';
import UseCaseSchema from '../security-for-building-sites/UseCaseSchema';

export const metadata: Metadata = {
  title: 'SIA Door Supervisors for Nightclubs',
  description: 'Hire SIA-licensed door supervisors for your nightclub or bar directly through QuickGuard. Book by the shift, with licence details shown on each profile.',
  alternates: {
    canonical: 'https://quickguard.uk/security-for-nightclubs',
  },
  openGraph: {
    title: 'Nightclub & Bar Door Supervisors | Hire SIA Security UK',
    description: 'Hire SIA-licensed door supervisors for your nightclub or bar directly through QuickGuard. Book by the shift, with licence details shown on each profile.',
    url: 'https://quickguard.uk/security-for-nightclubs',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20professional%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%20background%2C%20cinematic%20high-end%20photography%20style%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20for%20text%20overlay%2C%20modern%20minimalist%20web%20design%20hero%20aesthetic%2C%20excellent%20contrast%20ensuring%20text%20readability%2C%20dramatic%20lighting%20with%20rim%20light%20on%20the%20subject%2C%20simple%20uncluttered%20background%20composition%2C%20premium%20commercial%20photography&width=1200&height=630&seq=qg_nightclub_og_20260702&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — Nightclub & Bar Door Supervisors UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nightclub & Bar Door Supervisors | Hire SIA Security UK',
    description: 'Hire SIA-licensed door supervisors for your nightclub or bar directly through QuickGuard. Book by the shift, with licence details shown on each profile.',
    images: ['https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20professional%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%20background%2C%20cinematic%20high-end%20photography%20style%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20for%20text%20overlay%2C%20modern%20minimalist%20web%20design%20hero%20aesthetic%2C%20excellent%20contrast%20ensuring%20text%20readability%2C%20dramatic%20lighting%20with%20rim%20light%20on%20the%20subject%2C%20simple%20uncluttered%20background%20composition%2C%20premium%20commercial%20photography&width=1200&height=630&seq=qg_nightclub_og_20260702&orientation=landscape'],
  },
};

const data = {
  slug: 'security-for-nightclubs',
  title: 'Nightclub & Bar Security',
  headline: 'Hire SIA Door Supervisors for Your Venue',
  subheadline: 'Professional door staff from SIA-licensed door supervisors, with licence details shown on each profile. Book the shifts you need, when you need them.',
  heroImage: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20door%20supervisor%20standing%20confidently%20at%20the%20entrance%20of%20a%20modern%20upscale%20nightclub%20with%20neon%20ambient%20lighting%2C%20dark%20moody%20atmosphere%20with%20deep%20blue%20and%20teal%20colour%20palette%2C%20sharp%20professional%20uniform%20with%20visible%20SIA%20badge%2C%20blurred%20crowd%20and%20city%20nightlife%20in%20soft%20focus%20background%2C%20cinematic%20high-end%20photography%20style%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20for%20text%20overlay%2C%20modern%20minimalist%20web%20design%20hero%20aesthetic%2C%20excellent%20contrast%20ensuring%20text%20readability%2C%20dramatic%20lighting%20with%20rim%20light%20on%20the%20subject%2C%20simple%20uncluttered%20background%20composition%2C%20premium%20commercial%20photography&width=1280&height=720&seq=qg_nightclub_hero_20260508&orientation=landscape',
  venueCategory: 'nightclub_bar',
  ctaLabel: 'Hire a Door Supervisor',
  steps: [
    { icon: 'ri-file-list-line', title: 'Describe Your Night', desc: 'Tell us your venue, dates, and how many door staff you need.' },
    { icon: 'ri-user-search-line', title: 'Guards Apply', desc: 'Door supervisors near you whose licence and availability fit your job can apply.' },
    { icon: 'ri-shield-check-line', title: 'Pick Your Guard', desc: 'Review profiles, ratings, and SIA badge numbers before confirming.' },
    { icon: 'ri-lock-line', title: 'Payment Before Confirmation', desc: 'Pay by card through Stripe to confirm the booking. Release follows your completion approval and the applicable checks.' },
  ],
  faqs: [
    { q: 'Do all guards have a valid Door Supervisor licence?', a: 'Door supervision is a licensable activity where it is carried out for a venue, and licence details are shown on each operative’s profile so you can review them before confirming. Where a role involves licensable security activity, QuickGuard helps you identify professionals holding the appropriate SIA licence. Not every venue role is licensable, so check the licence type against the duties you need covered.' },
    { q: 'How quickly can I get a door supervisor?', a: 'Response times depend on availability in your area. For urgent same-night cover, select "Immediate" urgency when posting and review the operatives who respond.' },
    { q: 'What if a guard does not show up?', a: 'You can re-post the shift at no extra cost, and any payment release can be paused while the attendance issue is reviewed. If an operative fails to attend, it is recorded on the platform.' },
    { q: 'Is there a minimum number of shifts?', a: 'No minimum. Book a single night, a weekend or a full season — you only book the shifts you need.' },
    { q: 'What are typical hourly rates for door supervisors?', a: 'Rates typically range from £13 to £20 per hour depending on location and night. You set the rate and guards choose whether to apply.' },
  ],
};

export default function NightclubSecurityPage() {
  return (
    <>
      <UseCaseSchema
        title="Nightclub & Bar Security"
        slug="security-for-nightclubs"
        description="Hire SIA-licensed door supervisors for your nightclub or bar directly through QuickGuard. No agency fees, no contracts."
      />
      <UseCasePage data={data} />
    </>
  );
}
