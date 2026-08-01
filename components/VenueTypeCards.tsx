'use client';

import Link from 'next/link';

const venueTypes = [
  { key: 'nightclub_bar', label: 'Nightclubs & Bars', icon: 'ri-door-open-line', desc: 'Door supervisors' },
  { key: 'retail_shop', label: 'Retail & Shops', icon: 'ri-store-2-line', desc: 'Loss prevention' },
  { key: 'construction_site', label: 'Construction', icon: 'ri-hammer-line', desc: 'Site security' },
  { key: 'private_event', label: 'Private Events', icon: 'ri-calendar-event-line', desc: 'Weddings & parties' },
  { key: 'festival_public_event', label: 'Festivals', icon: 'ri-group-line', desc: 'Crowd control' },
  { key: 'warehouse_property', label: 'Warehouses', icon: 'ri-archive-line', desc: 'Property guarding' },
  { key: 'office_building', label: 'Offices', icon: 'ri-building-2-line', desc: 'Reception security' },
];

export default function VenueTypeCards() {
  return (
    <section className="py-16 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="venues-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <i className="ri-map-pin-line" aria-hidden="true"></i>
            For Every Venue
          </div>
          <h2 id="venues-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
            Security for Any Setting
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            From nightclubs to construction sites, hire the right guard for your specific needs
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {venueTypes.map((v) => (
            <Link
              key={v.key}
              href={`/post-job?venue=${v.key}`}
              prefetch={false}
              className="group bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 text-center hover:border-teal-500/40 transition-all hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-teal-400/20 group-hover:bg-teal-500/20 transition-colors">
                <i className={`${v.icon} text-xl text-teal-400`} aria-hidden="true"></i>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{v.label}</h3>
              <p className="text-xs text-slate-500">{v.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}