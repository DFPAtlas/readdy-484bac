'use client';

interface Guard {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  sia_licence_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean | null;
  sia_verified_at: string | null;
  verification_status: string | null;
  verified_at: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  total_earnings: number | null;
  years_experience: number | null;
  hourly_rate: number | null;
  licence_types: string[] | null;
  certifications: string[] | null;
  profile_completed: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  willing_to_travel: boolean | null;
  has_transport: boolean | null;
  max_distance_miles: number | null;
  bank_account_verified: boolean | null;
  rejection_reason: string | null;
  notes?: string | null;
}

interface GuardProfileCardProps {
  guard: Guard;
  onClick: (guard: Guard) => void;
}

export default function GuardProfileCard({ guard, onClick }: GuardProfileCardProps) {
  const initials = guard.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const gradients = [
    'from-teal-500 to-cyan-600',
    'from-emerald-500 to-green-600',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-orange-500 to-amber-600',
  ];
  const gradient = gradients[guard.id.charCodeAt(0) % gradients.length];

  const statusColor =
    guard.verification_status === 'approved'
      ? 'bg-emerald-500'
      : guard.verification_status === 'pending' || guard.verification_status === 'manual_review' || guard.verification_status === 'pending_sia_check'
      ? 'bg-amber-400'
      : guard.verification_status === 'rejected'
      ? 'bg-red-500'
      : 'bg-slate-500';

  const statusLabel =
    guard.verification_status === 'approved'
      ? 'Approved'
      : guard.verification_status === 'pending' || guard.verification_status === 'manual_review' || guard.verification_status === 'pending_sia_check'
      ? 'Pending'
      : guard.verification_status === 'rejected'
      ? 'Rejected'
      : 'Unverified';

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <i
        key={i}
        className={`text-xs ${i < Math.round(rating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-slate-600'}`}
      ></i>
    ));
  };

  return (
    <div
      onClick={() => onClick(guard)}
      className="relative overflow-visible bg-[#111d35] border border-[#1a2b4a] rounded-2xl hover:shadow-lg hover:border-teal-500/40 transition-all cursor-pointer group"
    >
      <div className={`relative z-0 bg-gradient-to-r ${gradient} h-16`}>
        <span className={`absolute z-10 top-2 right-2 px-2 py-0.5 ${statusColor} text-white text-xs font-semibold rounded-full`}>
          {statusLabel}
        </span>
        {guard.sia_verified && (
          <span className="absolute z-10 top-2 left-2 px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full flex items-center gap-1">
            <i className="ri-id-card-line text-xs"></i> SIA
          </span>
        )}
      </div>

      <div className="relative z-20 px-5 pb-5">
        <div className={`relative z-30 -mt-7 mb-3 w-14 h-14 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl text-white font-bold text-lg shadow-md ring-2 ring-[#111d35]`}>
          {initials}
        </div>

        <h3 className="relative z-30 font-semibold text-white text-base truncate group-hover:text-teal-400 transition-colors">
          {guard.full_name}
        </h3>
        <p className="relative z-30 text-xs text-slate-400 truncate mb-1">{guard.email}</p>

        <div className="relative z-30 flex items-center gap-1 mb-3">
          {guard.rating && guard.rating > 0 ? (
            <>
              {renderStars(guard.rating)}
              <span className="text-xs text-slate-400 ml-1">{Number(guard.rating).toFixed(1)} ({guard.total_reviews || 0})</span>
            </>
          ) : (
            <span className="text-xs text-slate-500">No reviews yet</span>
          )}
        </div>

        <div className="relative z-30 grid grid-cols-3 gap-2 mb-4">
          <div className="bg-teal-500/10 rounded-lg p-2 text-center">
            <p className="text-base font-bold text-teal-400">{guard.total_jobs_completed || 0}</p>
            <p className="text-xs text-slate-500">Jobs</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-2 text-center">
            <p className="text-base font-bold text-purple-400">£{((guard.total_earnings || 0) / 1000).toFixed(1)}k</p>
            <p className="text-xs text-slate-500">Earned</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2 text-center">
            <p className="text-base font-bold text-blue-400">{guard.years_experience || 0}yr</p>
            <p className="text-xs text-slate-500">Exp.</p>
          </div>
        </div>

        <div className="relative z-30 flex items-center justify-between text-xs text-slate-400 mb-3">
          <div className="flex items-center gap-1">
            <i className="ri-map-pin-line"></i>
            <span className="truncate max-w-[80px]">{guard.location || 'No location'}</span>
          </div>
          <div className="flex items-center gap-1">
            <i className="ri-money-pound-circle-line"></i>
            <span>£{guard.hourly_rate || '—'}/hr</span>
          </div>
        </div>

        <div className="relative z-30 pt-3 border-t border-[#1a2b4a] flex items-center gap-2 flex-wrap">
          {guard.licence_types && guard.licence_types.length > 0 ? (
            <>
              <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-xs rounded-full truncate max-w-[90px]">
                {guard.licence_types[0]}
              </span>
              {guard.licence_types.length > 1 && (
                <span className="px-2 py-0.5 bg-[#1a2b4a] text-slate-400 text-xs rounded-full">
                  +{guard.licence_types.length - 1}
                </span>
              )}
            </>
          ) : (
            <span className="px-2 py-0.5 bg-[#1a2b4a] text-slate-500 text-xs rounded-full">No licence types</span>
          )}
          {!guard.is_active && (
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full ml-auto">Inactive</span>
          )}
        </div>
      </div>
    </div>
  );
}