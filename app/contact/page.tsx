import type { Metadata } from 'next';
import ContactClient from './ContactClient';
import ContactSchema from './ContactSchema';

export const metadata: Metadata = {
  title: 'Contact QuickGuard for Security Hire',
  description:
    'Get in touch with QuickGuard for security guard bookings, SIA verification queries, or partnerships. UK-based team, 24/7 support for clients and guards.',
  keywords:
    'contact QuickGuard, security guard support, client enquiries, QuickGuard help, UK security staffing contact',
  alternates: {
    canonical: 'https://quickguard.uk/contact',
  },
  openGraph: {
    title: 'Contact Us | QuickGuard',
    description:
      'Reach out to the QuickGuard team for support, enquiries, or partnerships. We respond within 24 hours.',
    url: 'https://quickguard.uk/contact',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=friendly%20professional%20UK%20customer%20support%20team%20working%20in%20a%20modern%20London%20office%2C%20warm%20natural%20lighting%2C%20open%20plan%20workspace%20with%20large%20windows%20overlooking%20the%20city%2C%20diverse%20team%20members%20at%20desks%20with%20laptops%2C%20welcoming%20and%20approachable%20atmosphere%2C%20navy%20and%20white%20brand%20colors%20subtly%20in%20decor%2C%20clean%20and%20professional%20corporate%20photography%20style&width=1200&height=630&seq=og-contact-001&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'Contact QuickGuard — UK Security Staffing Support Team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | QuickGuard',
    description: 'Reach out to the QuickGuard team for support, enquiries, or partnerships. We respond within 24 hours.',
    images: ['https://readdy.ai/api/search-image?query=friendly%20professional%20UK%20customer%20support%20team%20working%20in%20a%20modern%20London%20office%2C%20warm%20natural%20lighting%2C%20open%20plan%20workspace%20with%20large%20windows%20overlooking%20the%20city%2C%20diverse%20team%20members%20at%20desks%20with%20laptops%2C%20welcoming%20and%20approachable%20atmosphere%2C%20navy%20and%20white%20brand%20colors%20subtly%20in%20decor%2C%20clean%20and%20professional%20corporate%20photography%20style&width=1200&height=630&seq=og-contact-001&orientation=landscape'],
  },
};

export default function ContactPage() {
  return (
    <>
      <ContactSchema />
      <ContactClient />
    </>
  );
}
