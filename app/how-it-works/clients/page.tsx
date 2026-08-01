import type { Metadata } from 'next';
import ClientHowItWorks from './ClientHowItWorks';

export const metadata: Metadata = {
  title: 'How to Hire a Security Guard Directly | QuickGuard for Clients',
  description:
    'Learn how to hire SIA-licensed security guards directly on QuickGuard. No agency, no contracts. Post your job, browse verified guards, and book by the shift in minutes.',
  keywords:
    'hire security guard directly UK, no agency security hire, book security by shift, SIA verified guards, direct security booking',
  alternates: {
    canonical: 'https://quickguard.uk/how-it-works/clients',
  },
  openGraph: {
    title: 'How It Works for Direct Clients | QuickGuard',
    description: 'Hire SIA-licensed security guards directly. No agency fees. No contracts. Book by the shift.',
    url: 'https://quickguard.uk/how-it-works/clients',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=630&seq=hiw-clients-og-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'How QuickGuard Works for Direct Clients — Hire Guards Directly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works for Direct Clients | QuickGuard',
    description: 'Hire SIA-licensed security guards directly. No agency fees. No contracts. Book by the shift.',
    images: [
      'https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=630&seq=hiw-clients-og-001&orientation=landscape',
    ],
  },
};

export default function HowItWorksClientsPage() {
  return <ClientHowItWorks />;
}