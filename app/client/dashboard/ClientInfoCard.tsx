interface ClientDetails {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  business_address: string;
  subscription_tier: string;
  created_at: string;
  verification_status: string;
}

import Link from 'next/link';

export default function ClientInfoCard({ client }: { client: ClientDetails }) {
  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Company Details</h2>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          client.verification_status === 'verified'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
        }`}>
          <i className={`${client.verification_status === 'verified' ? 'ri-shield-check-line' : 'ri-time-line'} mr-1`}></i>
          {client.verification_status === 'verified' ? 'Verified' : 'Pending'}
        </span>
      </div>

      <div className="space-y-3">
        {[
          { icon: 'ri-building-2-line', label: 'Company', value: client.company_name },
          { icon: 'ri-user-line', label: 'Contact', value: client.contact_name },
          { icon: 'ri-mail-line', label: 'Email', value: client.email },
          { icon: 'ri-phone-line', label: 'Phone', value: client.phone },
          { icon: 'ri-map-pin-line', label: 'Address', value: client.business_address },
        ].map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 dark:bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${row.icon} text-slate-500 text-sm`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{row.value || '—'}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/client/profile"
        className="mt-5 w-full flex items-center justify-center gap-2 bg-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-edit-line"></i>
        Edit Profile
      </Link>
    </div>
  );
}
