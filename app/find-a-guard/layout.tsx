import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find SIA Security Guards UK',
  description:
    'Browse and book verified SIA-licensed security guards across the UK. Filter by licence type, venue category, rating, and postcode. Direct booking with no agency fees.',
  keywords:
    'find security guard UK, browse SIA guards, hire security guard, door supervisor, event security, QuickGuard guards',
  alternates: {
    canonical: 'https://quickguard.uk/find-a-guard',
  },
  openGraph: {
    title: 'Find a Security Guard UK | QuickGuard',
    description:
      'Browse verified SIA-licensed security guards across the UK. Filter by licence type, rating, and postcode.',
    url: 'https://quickguard.uk/find-a-guard',
    siteName: 'QuickGuard',
    type: 'website',
  },
};

export default function FindAGuardLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://quickguard.uk' },
      { '@type': 'ListItem', position: 2, name: 'Find a Guard', item: 'https://quickguard.uk/find-a-guard' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}