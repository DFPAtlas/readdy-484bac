import type { Metadata } from 'next';
import HelpContent from './HelpContent';

export const metadata: Metadata = {
  title: 'QuickGuard Help Centre | Guard Availability, Plans & Payments',
  description:
    'Answers about checking guard availability before you sign in, client plan allowances and service fees, provisional guard selection, Stripe payment, check-in and completion approval, guard payouts, and free guard applications.',
  keywords:
    'QuickGuard help, security guard availability check, SIA licence verification, client plan allowances, guard payouts, completion approval, QuickGuard support',
  alternates: {
    canonical: 'https://quickguard.uk/help',
  },
  openGraph: {
    title: 'Help Centre | QuickGuard',
    description:
      'How availability checks, client plans and fees, payment confirmation, completion approval and guard payouts work. AI Support 24/7 with human support on weekdays.',
    url: 'https://quickguard.uk/help',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=modern%20UK%20online%20help%20centre%20knowledge%20base%20concept%2C%20clean%20teal%20and%20white%20interface%20with%20FAQ%20cards%20and%20search%20bar%20on%20screen%2C%20friendly%20support%20icons%2C%20shield%20and%20question%20mark%20motifs%2C%20professional%20flat%20design%20on%20light%20gradient%20background%2C%20no%20people%2C%20minimalist%20and%20informative%20visual%20style%2C%20navy%20accent%20colors&width=1200&height=630&seq=og-help-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard Help Centre — FAQs and Support for Security Guard Hiring',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help Centre | QuickGuard',
    description:
      'Availability checks, client plans and fees, payment confirmation, completion approval and guard payouts explained.',
    images: [
      'https://readdy.ai/api/search-image?query=modern%20UK%20online%20help%20centre%20knowledge%20base%20concept%2C%20clean%20teal%20and%20white%20interface%20with%20FAQ%20cards%20and%20search%20bar%20on%20screen%2C%20friendly%20support%20icons%2C%20shield%20and%20question%20mark%20motifs%2C%20professional%20flat%20design%20on%20light%20gradient%20background%2C%20no%20people%2C%20minimalist%20and%20informative%20visual%20style%2C%20navy%20accent%20colors&width=1200&height=630&seq=og-help-001&orientation=landscape',
    ],
  },
};

export default function HelpPage() {
  return <HelpContent />;
}
