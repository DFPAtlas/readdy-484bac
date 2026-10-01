import type { Metadata } from 'next';
import { Pacifico } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';
import { Suspense } from 'react';
import { BRAND_LOGO } from '@/lib/brand';

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
  manifest: '/manifest.webmanifest',
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
        url: BRAND_LOGO.social,
        width: 1200,
        height: 630,
        alt: 'QuickGuard - Hire SIA Licensed Security Guards Directly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hire SIA-Licensed Security Guards Directly | QuickGuard UK',
    description:
      'Book verified SIA-licensed security guards directly. No agency fees. Pay by the shift with held payment.',
    images: [BRAND_LOGO.social],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuickGuard',
  },
  icons: {
    icon: BRAND_LOGO.favicon,
    shortcut: BRAND_LOGO.favicon,
    apple: [
      {
        url: BRAND_LOGO.appIcon,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" className={pacifico.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://storage.helloreaddy.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://readdy.ai" crossOrigin="anonymous" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-GYTYP412SF"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-GYTYP412SF');`,
          }}
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
      </body>
    </html>
  );
}