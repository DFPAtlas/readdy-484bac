import type { Metadata } from 'next';
import { Pacifico } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';
import ReaddyWidget from '@/components/ReaddyWidget';
import { Suspense } from 'react';

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1933' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Hire SIA-Licensed Security Guards Directly | QuickGuard UK',
    template: '%s | QuickGuard',
  },
  description:
    'Book verified SIA-licensed security guards directly for your venue, event, or site. No agency fees, no contracts. Pay by the shift with Stripe held job payments. UK-wide coverage.',
  keywords:
    'security guards UK, SIA licensed, hire security, event security, door supervisor, security jobs, UK security staffing',
  metadataBase: new URL('https://quickguard.uk'),
  alternates: {
    canonical: 'https://quickguard.uk',
  },
  openGraph: {
    title: 'Hire SIA-Licensed Security Guards Directly | QuickGuard UK',
    description:
      'Book verified SIA-licensed security guards directly for your venue, event, or site. No agency fees, no contracts. Pay by the shift with Stripe held job payments. UK-wide coverage.',
    url: 'https://quickguard.uk',
    siteName: 'QuickGuard',
    type: 'website',
    locale: 'en_GB',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Minimalist%20professional%20security%20company%20logo%20featuring%20the%20letter%20Q%20in%20elegant%20serif%20font%20on%20a%20dark%20navy%20blue%20background%20with%20subtle%20teal%20accent%20glow%20around%20the%20letter%2C%20clean%20corporate%20branding%20style%2C%20no%20shadows%20or%20gradients%20on%20the%20letter%20itself%2C%20flat%20design%20aesthetic%2C%20perfect%20square%20composition%2C%20professional%20logo%20design%20for%20a%20UK%20security%20staffing%20platform%2C%20dark%20background%20with%20the%20white%20and%20teal%20letter%20Q%20centered%2C%20no%20additional%20text%20or%20elements%2C%20pure%20and%20simple%20logo%20mark%2C%20suitable%20for%20favicon%20and%20social%20media%20sharing%2C%20high%20contrast%20and%20crisp%2C%20modern%20minimalist%20brand%20identity&width=512&height=512&seq=quickguard_og_logo_20260503&orientation=squarish',
        width: 512,
        height: 512,
        alt: 'QuickGuard - Hire SIA Licensed Security Guards Directly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hire SIA-Licensed Security Guards Directly | QuickGuard UK',
    description:
      'Book verified SIA-licensed security guards directly. No agency fees. Pay by the shift with held payment.',
    images: ['https://readdy.ai/api/search-image?query=Minimalist%20professional%20security%20company%20logo%20featuring%20the%20letter%20Q%20in%20elegant%20serif%20font%20on%20a%20dark%20navy%20blue%20background%20with%20subtle%20teal%20accent%20glow%20around%20the%20letter%2C%20clean%20corporate%20branding%20style%2C%20no%20shadows%20or%20gradients%20on%20the%20letter%20itself%2C%20flat%20design%20aesthetic%2C%20perfect%20square%20composition%2C%20professional%20logo%20design%20for%20a%20UK%20security%20staffing%20platform%2C%20dark%20background%20with%20the%20white%20and%20teal%20letter%20Q%20centered%2C%20no%20additional%20text%20or%20elements%2C%20pure%20and%20simple%20logo%20mark%2C%20suitable%20for%20favicon%20and%20social%20media%20sharing%2C%20high%20contrast%20and%20crisp%2C%20modern%20minimalist%20brand%20identity&width=512&height=512&seq=quickguard_twitter_logo_20260503&orientation=squarish'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" className={pacifico.variable} suppressHydrationWarning>
      <head>
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.5.0/remixicon.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense fallback={
          <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <ClientLayout>{children}</ClientLayout>
        </Suspense>
        <ReaddyWidget />
      </body>
    </html>
  );
}