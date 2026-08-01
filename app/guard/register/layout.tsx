import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register as a Security Guard UK | SIA Verified | QuickGuard',
  description:
    'Join QuickGuard as an SIA-licensed security guard. Find flexible security jobs across the UK, earn £15-30/hr, and get paid weekly. Free registration.',
  keywords:
    'register security guard UK, SIA licence, security jobs, door supervisor register, QuickGuard guard signup',
  alternates: {
    canonical: 'https://quickguard.uk/guard/register',
  },
  openGraph: {
    title: 'Register as a Security Guard UK | QuickGuard',
    description:
      'Join QuickGuard as an SIA-licensed security guard. Flexible jobs across the UK, earn £15-30/hr.',
    url: 'https://quickguard.uk/guard/register',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}