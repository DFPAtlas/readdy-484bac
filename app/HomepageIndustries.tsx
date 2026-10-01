import Link from 'next/link';

type Industry = {
  icon: string;
  label: string;
  href: string;
};

const industries: Industry[] = [
  { icon: 'ri-shield-star-line', label: 'Security Companies', href: '/security-companies' },
  { icon: 'ri-goblet-line', label: 'Pubs & Bars', href: '/pubs-bars-nightclubs' },
  { icon: 'ri-door-open-line', label: 'Nightclubs', href: '/pubs-bars-nightclubs' },
  { icon: 'ri-calendar-event-line', label: 'Events', href: '/event-security' },
  { icon: 'ri-hotel-line', label: 'Hotels', href: '/hotel-security' },
  { icon: 'ri-store-2-line', label: 'Retail', href: '/retail-security' },
  { icon: 'ri-hammer-line', label: 'Construction', href: '/construction-security' },
  { icon: 'ri-archive-line', label: 'Warehouses', href: '/industries' },
];

export default function HomepageIndustries() {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-sm text-slate-400">Security for:</span>
        {industries.map((industry) => (
          <Link
            key={industry.label}
            href={industry.href}
            prefetch={false}
            className="group flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-400 transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <i className={`${industry.icon} text-teal-400 text-sm`} aria-hidden="true"></i>
            </div>
            {industry.label}
          </Link>
        ))}
      </div>
      <Link
        href="/industries"
        prefetch={false}
        className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
      >
        View all industries
        <i className="ri-arrow-right-line" aria-hidden="true"></i>
      </Link>
    </div>
  );
}