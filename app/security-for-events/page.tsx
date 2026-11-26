import type { Metadata } from 'next';
import UseCaseSchema from '../security-for-building-sites/UseCaseSchema';
import SecurityForEventsPage from './SecurityForEventsPage';
import { EVENTS_CONTENT } from './securityForEventsContent';

export const metadata: Metadata = {
  title: 'Event Security Guards for Weddings & Parties',
  description:
    'Check matching guard availability for a private event, wedding, party or corporate function, then sign in to review and confirm the posting. Staffing levels follow your own risk assessment, the venue, the duties and licensing conditions; a check is not a reservation and cover is not guaranteed.',
  alternates: {
    canonical: 'https://quickguard.uk/security-for-events',
  },
  openGraph: {
    title: 'Event Security Guards for Weddings & Parties',
    description:
      'Check recorded guard availability for a private event, then sign in to review and confirm the posting. A guest check is not a reservation and does not guarantee cover.',
    url: 'https://quickguard.uk/security-for-events',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_events_og_20260702&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — event security guards for weddings, parties and private functions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Event Security Guards for Weddings & Parties',
    description:
      'Check recorded guard availability for a private event, then sign in to review and confirm the posting. A guest check is not a reservation and does not guarantee cover.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20smart%20black%20formal%20uniform%20with%20visible%20SIA%20badge%20standing%20at%20an%20elegant%20outdoor%20wedding%20marquee%20event%20with%20white%20draped%20fabric%20and%20string%20lights%20visible%20in%20soft%20evening%20light%2C%20guests%20mingling%20in%20the%20warm%20golden%20bokeh%20background%2C%20sophisticated%20and%20festive%20atmosphere%2C%20deep%20navy%20blue%20and%20warm%20gold%20colour%20palette%2C%20left%20side%20features%20clean%20dark%20gradient%20background%20ideal%20for%20white%20text%20overlay%2C%20high-end%20editorial%20photography%20style%20with%20natural%20lighting%2C%20modern%20minimalist%20composition%2C%20premium%20event%20security%20aesthetic%2C%20realistic%20sharp%20details%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=qg_events_og_20260702&orientation=landscape',
    ],
  },
};

export default function SecurityForEventsRoute() {
  return (
    <>
      <UseCaseSchema
        title="Event Security Guards"
        slug="security-for-events"
        description="Event security staffing for weddings, private parties and corporate functions. A guest availability check uses recorded guard details, is not a reservation and does not guarantee cover; staffing levels follow the client's own risk assessment, venue, duties and licensing conditions."
      />
      <SecurityForEventsPage content={EVENTS_CONTENT} />
    </>
  );
}