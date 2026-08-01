'use client';

interface Guard {
  id: string;
  full_name: string;
  profile_image_url: string;
  hourly_rate: number;
  rating: number;
  sia_verified: boolean;
  hours_worked?: number;
}

interface AssignedGuardsSectionProps {
  guards: Guard[];
  hourlyRate: number;
  hours: number;
}

export default function AssignedGuardsSection({ guards, hourlyRate, hours }: AssignedGuardsSectionProps) {
  const guardEarnings = hourlyRate * hours;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="ri-team-line text-teal-400"></i>
          Assigned Guards ({guards.length})
        </h3>
        <span className="text-sm text-slate-400">
          {hours.toFixed(1)} hours each
        </span>
      </div>

      {guards.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ri-user-line text-3xl text-slate-500"></i>
          </div>
          <p className="text-slate-400">No guards assigned to this job</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guards.map((guard) => (
            <div key={guard.id} className="flex items-center justify-between p-4 bg-[#162036] rounded-xl hover:bg-[#1a2642] transition-colors border border-[#1e2d4d]">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {guard.profile_image_url ? (
                    <img
                      src={guard.profile_image_url}
                      alt={guard.full_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {guard.full_name?.charAt(0) || 'G'}
                      </span>
                    </div>
                  )}
                  {guard.sia_verified && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#111d35]">
                      <i className="ri-check-line text-white text-xs"></i>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{guard.full_name || 'Security Guard'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <i className="ri-star-fill text-amber-400 text-sm"></i>
                      <span className="text-sm text-slate-400">{guard.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    {guard.sia_verified && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/25">
                        SIA Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-teal-400">£{guardEarnings.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{hours.toFixed(1)}h × £{hourlyRate}/hr</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#1e2d4d]">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total Guard Fees</span>
          <span className="text-xl font-bold text-white">
            £{(guardEarnings * guards.length).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
