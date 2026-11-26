import type { Metadata } from 'next';
import ClientHowItWorks from './ClientHowItWorks';

export const metadata: Metadata = {
  title: 'How Booking Security Guards Works for Clients',
  description:
    'How client booking works on QuickGuard: check recorded guard availability as a guest, post within your plan allowance, review eligible SIA-licensed responses, pay through Stripe, then approve completion or raise a dispute.',
  keywords:
    'security guard booking process, book security guards by shift, SIA licensed guards UK, client job posting allowance, guard availability check',
  alternates: {
    canonical: 'https://quickguard.uk/how-it-works/clients',
  },
  openGraph: {
    title: 'How Booking Works for Clients | QuickGuard',
    description:
      'Availability checks, plan allowances, eligible guard responses, Stripe payment before the shift, completion approval and payout explained.',
    url: 'https://quickguard.uk/how-it-works/clients',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=630&seq=hiw-clients-og-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'How booking security guards by shift works for clients on QuickGuard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Booking Works for Clients | QuickGuard',
    description:
      'Availability checks, plan allowances, eligible guard responses, Stripe payment before the shift, completion approval and payout explained.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=630&seq=hiw-clients-og-001&orientation=landscape',
    ],
  },
};

export default function HowItWorksClientsPage() {
  return <ClientHowItWorks />;
}