import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Login | QuickGuard Security Staffing',
  description:
    'Sign in to your QuickGuard client dashboard to post security jobs, manage bookings, and hire SIA-licensed guards across the UK.',
  keywords:
    'client login QuickGuard, hire security guards, security staffing dashboard, UK security booking',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: 'Client Login | QuickGuard',
    description:
      'Sign in to your QuickGuard client dashboard to post jobs and hire verified security guards.',
    url: 'https://quickguard.uk/client/login',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}