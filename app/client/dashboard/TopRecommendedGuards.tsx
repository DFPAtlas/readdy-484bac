'use client';

import { useRouter } from 'next/navigation';

interface RecommendedGuard {
  id: string;
  full_name: string;
  sia_licence_number: string;
  rating: number;
  total_reviews: number;
  years_experience: number;
  location: string;
  profile_image_url: string | null;
}

interface TopRecommendedGuardsProps {
  guards: RecommendedGuard[];
  loading?: boolean;
}

export default function TopRecommendedGuards({ guards, loading = false }: TopRecommendedGuardsProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-slate-200 dark:bg-[#1e2d4d] rounded w-40 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-[#1e2d4d] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Top Recommended Guards</h2>
        <button
          onClick={() => router.push('/find-a-guard')}
          className="text-sm text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
        >
          Find More
        </button>
      </div>

      {guards.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-slate-100 dark:bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-2">
            <i className="ri-shield-user-line text-xl text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">No guard recommendations yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guards.map((guard) => (
            <div
              key={guard.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#1e2d4d] bg-slate-50 dark:bg-[#162036] hover:bg-slate-100 dark:hover:bg-[#1a2642] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#1e2d4d] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {guard.profile_image_url ? (
                  <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-user-line text-lg text-slate-500 dark:text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{guard.full_name}</p>
                  {guard.sia_licence_number && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      SIA {guard.sia_licence_number}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <i className="ri-star-fill text-amber-400 text-[10px]" />
                    {guard.rating?.toFixed(1) || '—'}
                    <span className="text-slate-400">({guard.total_reviews || 0})</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>{guard.years_experience || 0} yrs exp</span>
                  <span className="text-slate-300">|</span>
                  <span className="truncate">{guard.location || 'UK'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => router.push(`/find-a-guard?guard=${guard.id}`)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  View Profile
                </button>
                <button
                  onClick={() => router.push('/client/post-job')}
                  className="px-3 py-1.5 text-xs font-semibold bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Invite
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}