'use client';

interface Client {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  company_type: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  total_jobs_posted: number | null;
  active_jobs: number | null;
  total_spent: number | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  is_suspended?: boolean | null;
}

interface ClientProfileCardProps {
  client: Client;
  onClick: (client: Client) => void;
}

export default function ClientProfileCard({ client, onClick }: ClientProfileCardProps) {
  const displayName =
    client.first_name && client.last_name
      ? `${client.first_name} ${client.last_name}`
      : client.contact_name || 'Unknown';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const gradients = [
    'from-teal-500 to-cyan-600',
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-orange-500 to-red-500',
    'from-emerald-500 to-teal-600',
  ];
  const gradient = gradients[client.id.charCodeAt(0) % gradients.length];

  return (
    <div
      onClick={() => onClick(client)}
      className="relative overflow-visible rounded-2xl bg-[#111d35] shadow-lg hover:shadow-2xl hover:-translate-y-1.5 hover:border-teal-500/30 transition-all duration-200 cursor-pointer group border border-[#1a2b4a]"
    >
      <div className={`relative z-0 h-24 rounded-t-2xl bg-gradient-to-r ${gradient}`}>
        {client.is_suspended && (
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full">
            Suspended
          </span>
        )}
        {!client.is_suspended && client.verified && (
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
            <i className="ri-checkbox-circle-fill text-xs"></i> Verified
          </span>
        )}
      </div>

      <div className="relative z-20 px-7 pb-6">
        <div className={`relative z-30 -mt-10 mb-4 h-16 w-16 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl text-white font-bold text-lg shadow-lg ring-4 ring-[#111d35]`}>
          {initials}
        </div>

        <h3 className="relative z-30 text-lg font-bold text-white truncate group-hover:text-teal-400 transition-colors">
          {displayName}
        </h3>
        <p className="relative z-30 text-sm text-slate-400 truncate mb-1">{client.company_name || 'No company'}</p>
        <p className="relative z-30 text-xs text-slate-500 truncate mb-4">{client.email}</p>

        <div className="relative z-30 grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#0a1628] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-teal-400">{client.total_jobs_posted || 0}</p>
            <p className="text-xs text-slate-500">Jobs</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{client.active_jobs || 0}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="bg-[#0a1628] rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-purple-400">£{((client.total_spent || 0) / 1000).toFixed(1)}k</p>
            <p className="text-xs text-slate-500">Spent</p>
          </div>
        </div>

        <div className="relative z-30 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <i className="ri-map-pin-line"></i>
            <span>{client.city || 'No location'}</span>
          </div>
          <div className="flex items-center gap-1">
            <i className="ri-calendar-line"></i>
            <span>
              {client.created_at
                ? new Date(client.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="relative z-30 mt-3 pt-3 border-t border-[#1a2b4a] flex items-center gap-2 flex-wrap">
          {client.profile_completed ? (
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Profile Complete</span>
          ) : (
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full">Incomplete</span>
          )}
          {client.industry && (
            <span className="px-2 py-0.5 bg-[#1a2b4a] text-slate-400 text-xs rounded-full truncate max-w-[100px]">
              {client.industry}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}