import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-helpers';

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'How It Works', path: '/how-it-works' },
];

export default function HowItWorksSchema() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: CRUMBS.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.path === '/' ? SITE_URL : `${SITE_URL}${crumb.path}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <nav aria-label="Breadcrumb trail" className="sr-only">
        <ol>
          {CRUMBS.map((crumb, index) => (
            <li key={crumb.path}>
              <Link href={crumb.path}>{crumb.name}</Link>
              {index < CRUMBS.length - 1 ? <span> / </span> : null}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}