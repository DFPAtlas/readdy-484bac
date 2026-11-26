import type { Metadata } from 'next';
import IndustrySchema from '@/components/industry/IndustrySchema';
import EventSecurityPage from './EventSecurityPage';
import { EVENT_CONTENT } from './eventContent';

export const metadata: Metadata = {
  title: 'Event Security Staffing UK | Check Availability | QuickGuard',
  description:
    'Check matching guard availability for an event, then sign in or register to review and confirm the posting. Staffing levels follow your own risk assessment, the venue and the duties; a check is not a reservation and no cover is guaranteed.',
  keywords:
    'event security staffing, festival stewards, concert security, exhibition security, event door supervision, check guard availability',
  alternates: {
    canonical: 'https://quickguard.uk/event-security',
  },
  openGraph: {
    title: 'Event Security Staffing UK | Check Guard Availability | QuickGuard',
    description:
      'Compare security and stewarding profiles for events. A guest availability check posts nothing, notifies no guard and does not guarantee cover.',
    url: 'https://quickguard.uk/event-security',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_events_hero_20261001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — event security staffing for festivals, concerts and venues',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Event Security Staffing UK | Check Guard Availability | QuickGuard',
    description:
      'Compare security and stewarding profiles for events. A guest availability check posts nothing, notifies no guard and does not guarantee cover.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20event%20security%20team%20in%20high-visibility%20black%20uniforms%20standing%20at%20the%20entrance%20of%20a%20large%20outdoor%20UK%20music%20festival%20at%20golden%20hour%2C%20crowds%20and%20stage%20lights%20in%20the%20blurred%20background%2C%20deep%20navy%20blue%20and%20teal%20colour%20palette%20with%20warm%20accents%2C%20cinematic%20wide%20angle%20with%20a%20clean%20dark%20gradient%20across%20the%20left%20side%20ideal%20for%20white%20text%20overlay%2C%20premium%20editorial%20photography%20style%2C%20sharp%20realistic%20details&width=1200&height=630&seq=ind_events_hero_20261001&orientation=landscape',
    ],
  },
};

export default function Page() {
  return (
    <>
      <IndustrySchema
        name="Event Security Staffing"
        slug="event-security"
        description="Event security staffing for concerts, festivals, exhibitions, sporting events and private functions, with duties and staffing levels set by the client's own risk assessment."
      />
      <EventSecurityPage content={EVENT_CONTENT} />
    </>
  );
}