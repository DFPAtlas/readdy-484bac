import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hire Security Guards UK | Register as a Client | QuickGuard',
  description:
    'Register your business on QuickGuard to hire verified SIA-licensed security guards across the UK. Event, retail, corporate security. Free to post jobs.',
  keywords:
    'hire security guards UK, register client QuickGuard, book security staff, event security hire',
  alternates: {
    canonical: 'https://quickguard.uk/client/register',
  },
  openGraph: {
    title: 'Hire Security Guards UK | Register as a Client | QuickGuard',
    description:
      'Register your business to hire verified SIA-licensed security guards across the UK. Free to post jobs.',
    url: 'https://quickguard.uk/client/register',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}