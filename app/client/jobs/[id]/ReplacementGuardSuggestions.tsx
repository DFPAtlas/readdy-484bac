'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Guard {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  sia_licence_number?: string;
  phone?: string;
  user_id?: string;
  sia_verified?: boolean;
  average_rating?: number | null;
  total_reviews?: number | null;
  total_jobs_completed?: number | null;
  years_experience?: number | null;
  location?: string | null;
  distance?: number;
  availability?: string;
  reason?: string;
}

interface ReplacementGuardSuggestionsProps {
  jobId: string;
  job: any;
  currentAssignments: any[];
  onApproveReplacement?: (guardId: string) => void;
  onRequestMore?: () => void;
}

export default function ReplacementGuardSuggestions({
  jobId,
  job,
  currentAssignments,
  onApproveReplacement,
  onRequestMore,
}: ReplacementGuardSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Guard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const loadSuggestions = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const guards = await fetchSuggestions();
      setSuggestions(guards);
      setLoaded(true);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (): Promise<Guard[]> => {
    const results: Guard[] = [];
    const currentGuardIds = currentAssignments.map(a => a.guards?.id).filter(Boolean);
    const requiredLicenceType = job?.required_license_type || job?.required_licence_types?.[0];
    const venueCity = job?.venue_city || job?.venue_name;

    // 1. Previously shortlisted guards who weren't selected
    try {
      const { data: applicants } = await supabase
        .from('job_applications')
        .select('guards(id, full_name, profile_photo_url, sia_licence_number, sia_verified, average_rating, total_reviews, total_jobs_completed, years_experience, location)')
        .eq('job_id', jobId)
        .not('guard_id', 'in', `(${currentGuardIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .limit(3);

      (applicants || []).forEach((a: any) => {
        if (a.guards && !results.find(g => g.id === a.guards.id)) {
          results.push({
            ...a.guards,
            reason: 'Previously shortlisted',
            availability: 'Applied before',
          });
        }
      });
    } catch {}

    // 2. Guards who worked this site before
    try {
      const { data: pastAssignments } = await supabase
        .from('job_assignments')
        .select('guards(id, full_name, profile_photo_url, sia_licence_number, sia_verified, average_rating, total_reviews, total_jobs_completed, years_experience, location)')
        .eq('job_id', jobId)
        .limit(5);

      const siteGuardIds = (pastAssignments || []).map((a: any) => a.guards?.id).filter(Boolean);
      if (siteGuardIds.length > 0) {
        const { data: otherSiteJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('client_id', job?.client_id)
          .neq('id', jobId)
          .limit(10);

        if (otherSiteJobs && otherSiteJobs.length > 0) {
          const { data: otherAssignments } = await supabase
            .from('job_assignments')
            .select('guards(id, full_name, profile_photo_url, sia_licence_number, sia_verified, average_rating, total_reviews, total_jobs_completed, years_experience, location)')
            .in('job_id', otherSiteJobs.map(j => j.id))
            .not('guard_id', 'in', `(${currentGuardIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
            .limit(3);

          (otherAssignments || []).forEach((a: any) => {
            if (a.guards && !results.find(g => g.id === a.guards.id)) {
              results.push({
                ...a.guards,
                reason: 'Worked your site before',
                availability: 'Familiar with site',
              });
            }
          });
        }
      }
    } catch {}

    // 3. Similar available guards nearby
    try {
      let query = supabase
        .from('guards')
        .select('id, full_name, profile_photo_url, sia_licence_number, sia_verified, average_rating, total_reviews, total_jobs_completed, years_experience, location')
        .eq('sia_verified', true)
        .eq('is_active', true)
        .not('id', 'in', `(${currentGuardIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .order('average_rating', { ascending: false })
        .limit(3);

      if (requiredLicenceType) {
        query = query.ilike('licence_types', `%${requiredLicenceType}%`);
      }

      const { data: nearbyGuards } = await query;
      (nearbyGuards || []).forEach((g: any) => {
        if (!results.find(r => r.id === g.id)) {
          results.push({
            ...g,
            reason: 'Available & rated',
            availability: 'Available',
          });
        }
      });
    } catch {}

    return results.slice(0, 5);
  };

  const handleApprove = async (guardId: string) => {
    setApproving(guardId);
    try {
      // TODO: Create a new assignment for this guard as replacement
      // This would require backend support for replacement assignments
      onApproveReplacement?.(guardId);
    } catch {
    } finally {
      setApproving(null);
    }
  };

  if (!loaded) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <i className="ri-user-search-line text-violet-400 text-lg"></i>
            Suggested Replacement Guards
          </h3>
          <button
            onClick={loadSuggestions}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="ri-search-line"></i>
            )}
            {loading ? 'Searching…' : 'Find Replacements'}
          </button>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-8 text-center">
          <div className="w-12 h-12 bg-[#111d35] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-user-search-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-500">Click "Find Replacements" to see available guards</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <i className="ri-user-search-line text-violet-400 text-lg"></i>
            Suggested Replacements
          </h3>
        </div>
        <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-8 text-center">
          <div className="w-12 h-12 bg-[#111d35] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-user-unfollow-line text-2xl text-slate-600"></i>
          </div>
          <p className="text-sm font-semibold text-slate-400 mb-1">No immediate matches found</p>
          <p className="text-xs text-slate-500 mb-4">Our team is manually searching for a suitable replacement</p>
          <button
            onClick={onRequestMore}
            className="inline-flex items-center gap-2 bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-customer-service-2-line"></i>
            Contact QuickGuard Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="ri-user-search-line text-violet-400 text-lg"></i>
          Suggested Replacement Guards
          <span className="bg-violet-500/15 text-violet-400 text-xs font-bold px-2 py-0.5 rounded-full">{suggestions.length}</span>
        </h3>
        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line"></i> Refresh
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.map((guard) => {
          const initials = guard.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??';
          return (
            <div key={guard.id} className="flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d] hover:border-violet-500/30 transition-colors">
              <div className="w-11 h-11 rounded-full bg-[#111d35] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                {guard.profile_photo_url ? (
                  <img src={guard.profile_photo_url} alt={initials} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-teal-400 font-bold text-xs">{initials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-200 truncate">{guard.full_name || 'Unknown Guard'}</p>
                  {guard.sia_verified && (
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                      <i className="ri-shield-check-line mr-0.5"></i>
                      SIA Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  {guard.average_rating && (
                    <span className="flex items-center gap-0.5">
                      <i className="ri-star-fill text-amber-400"></i>
                      {guard.average_rating.toFixed(1)}
                    </span>
                  )}
                  {guard.total_reviews && (
                    <span>({guard.total_reviews} reviews)</span>
                  )}
                  {guard.years_experience && (
                    <span>{guard.years_experience} yrs exp</span>
                  )}
                  {guard.location && (
                    <span className="flex items-center gap-0.5">
                      <i className="ri-map-pin-line"></i>
                      {guard.location}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-violet-500/10 text-violet-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-500/25">
                    {guard.reason}
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                    {guard.availability}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove(guard.id)}
                  disabled={approving === guard.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-500 hover:bg-teal-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {approving === guard.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <i className="ri-check-line"></i>
                  )}
                  Approve
                </button>
                <Link href={`/client/jobs/${jobId}/select-guards`}>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-300 bg-[#111d35] hover:bg-[#1a2642] px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap w-full">
                    <i className="ri-eye-line"></i>
                    View Profile
                  </button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1e2d4d] flex items-center justify-between">
        <p className="text-xs text-slate-500">
          <i className="ri-information-line mr-1"></i>
          Approving will request this guard to confirm availability
        </p>
        <button
          onClick={onRequestMore}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-customer-service-2-line mr-1"></i>
          Need more options?
        </button>
      </div>
    </div>
  );
}