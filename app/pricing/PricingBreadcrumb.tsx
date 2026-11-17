import Link from 'next/link';

const crumbs = [
  { label: 'Home', href: '/' },
  { label: 'Pricing', href: '/pricing' },
];

export default function PricingBreadcrumb() {
  return (
    <div className="border-b border-slate-800/60 bg-[#0B1933]">
      <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-6 pt-24 pb-4">
        <ol className="flex items-center flex-wrap gap-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="text-slate-200 font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <>
                    <Link
                      href={crumb.href}
                      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors"
                    >
                      <i className="ri-home-4-line text-sm" />
                      {crumb.label}
                    </Link>
                    <i className="ri-arrow-right-s-line text-slate-600" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}