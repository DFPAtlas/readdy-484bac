'use client';

import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

export default function BreadcrumbNav({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm overflow-x-auto pb-1" aria-label="Breadcrumb">
      <Link href="/admin/dashboard" className="text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap cursor-pointer">
        Admin Dashboard
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-right-s-line text-slate-600 text-xs"></i>
            </div>
            {isLast || !crumb.href ? (
              <span className="text-slate-300 whitespace-nowrap">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap cursor-pointer">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}