import UseCasePage from '@/components/UseCasePage';
import type { Metadata } from 'next';
import UseCaseSchema from '../security-for-building-sites/UseCaseSchema';

export const metadata: Metadata = {
  title: 'Security for Events | Weddings, Parties, Festivals — QuickGuard',
  description: 'Hire SIA-licensed security guards for private events, weddings, parties, and festivals. Crowd control, guest safety, perimeter security. Direct booking with verified guards.',
  alternates: {
    canonical: 'https://quickguard.uk/security-for-events',
  },
  openGraph: {
    title: 'Security for Events | QuickGuard',
    description: 'Hire SIA-licensed security guards for weddings, parties, and festivals. Crowd control, guest safety.',
    url: 'https://quickguard.uk/security-for-events',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_events_og_20260702&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — Event Security Guards for Weddings, Parties & Festivals UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security for Events | QuickGuard',
    description: 'Hire SIA-licensed security guards for weddings, parties, and festivals. Crowd control, guest safety.',
    images: ['https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_events_og_20260702&orientation=landscape'],
  },
};

const data = {
  slug: 'security-for-events',
  title: 'Event Security',
  headline: 'Event Security Guards — Weddings, Parties & Festivals',
  subheadline: 'Keep your guests safe and your event smooth with SIA-verified security professionals. Book crowd control, guest list management, and perimeter security directly — one shift at a time.',
  heroImage: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20of%20image%20features%20a%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%20on%20the%20subject%2C%20simple%20uncluttered%20background&width=1600&height=900&seq=qg_events_hero_20260508&orientation=landscape',
  venueCategory: 'private_event',
  ctaLabel: 'Hire Event Security',
  steps: [
    { icon: 'ri-file-list-line', title: 'Event Details', desc: 'Tell us the venue, date, guest count, and what security tasks you need covered.' },
    { icon: 'ri-user-search-line', title: 'Guards Apply', desc: 'Event-specialist guards in your area see your job and apply within minutes.' },
    { icon: 'ri-shield-check-line', title: 'Select Your Team', desc: 'Pick guards with event experience, strong ratings, and the right attitude.' },
    { icon: 'ri-lock-line', title: 'Safe Payment', desc: 'Pay with Stripe. Released after the event when you confirm everything went well.' },
  ],
  faqs: [
    { q: 'How many guards do I need for my event?', a: 'As a rough guide: 1 guard per 75 guests for low-key events, 1 per 50 for parties with alcohol, and 1 per 25 for festivals or large public events. You can also ask guards to advise when they apply.' },
    { q: 'Can guards manage guest lists and door entry?', a: 'Yes. Many event guards have experience running guest lists, checking invites, wristband distribution, and managing VIP entry. Mention this in your job description.' },
    { q: 'Do you provide guards for festivals and public events?', a: 'Yes. QuickGuard covers everything from intimate private parties to multi-day festivals. Post the event details and multiple guards can apply as a team.' },
    { q: 'What if the event runs late?', a: 'Guards are paid by the hour. If the event overruns, discuss directly with the guard. QuickGuard supports fair overtime practices.' },
    { q: 'Can I book the same guards for my annual event?', a: 'Absolutely. Save guard profiles and re-invite them for next year. Many event organisers build a trusted team this way.' },
  ],
  testimonialQuote: 'We organise a summer garden party for 200 guests every year. Last year we paid an agency £3,200 for two security staff. This year through QuickGuard we paid £1,450 for the same coverage with guards we actually chose and trust. Never going back.',
  testimonialAuthor: 'Sophie L.',
  testimonialVenue: 'Event Organiser, Surrey',
};

export default function EventSecurityPage() {
  return (
    <>
      <UseCaseSchema
        title="Event Security"
        slug="security-for-events"
        description="Hire SIA-licensed security guards for private events, weddings, parties, and festivals. Crowd control, guest safety, perimeter security."
      />
      <UseCasePage data={data} />
    </>
  );
}