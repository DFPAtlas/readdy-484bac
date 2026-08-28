import type { Metadata } from 'next';
import { Pacifico } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';
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
        url: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
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
    images: ['https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuickGuard',
  },
  icons: {
    icon: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
    apple: [
      {
        url: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
        sizes: '180x180',
        type: 'image/webp',
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