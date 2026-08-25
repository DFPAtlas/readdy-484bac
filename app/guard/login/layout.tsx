import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Guard Login | QuickGuard Dashboard',
  description:
    'Sign in to your QuickGuard guard dashboard to find security jobs, manage your schedule, and track earnings. For SIA-licensed professionals across the UK.',
  keywords:
    'security guard login, QuickGuard dashboard, SIA guard sign in, find security jobs UK',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: 'Security Guard Login | QuickGuard',
    description:
      'Sign in to your QuickGuard guard dashboard to find security jobs and track earnings.',
    url: 'https://quickguard.uk/guard/login',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}