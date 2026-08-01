'use client';

import { computeComplianceInfo, GuardComplianceData } from "../compliance/useCompliance";
import { SIAStatusBadge } from "../compliance/GuardComplianceBadge";

interface Guard {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  hourly_rate: number | null;
  years_experience: number | null;
  sia_verified: boolean;
  sia_expiry_date: string | null;
  sia_licence_number: string | null;
  licence_types: string[] | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  has_transport: boolean | null;
  cover_message: string | null;
  applied_at: string | null;
  profile_completed?: boolean | null;
  verification_status?: string | null;
  certifications?: string[] | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  sia_verified_at?: string | null;
}

interface GuardCardProps {
  guard: Guard;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewProfile: (guard: Guard) => void;
  requiredLicenceTypes?: string[] | null;
}

export default function GuardCard({ guard, isSelected, onToggleSelect, onViewProfile, requiredLicenceTypes }: GuardCardProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <i
          key={i}
          className={`${i <= Math.round(rating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'} text-sm`}
        ></i>
      );
    }
    return stars;
  };

  const complianceData: GuardComplianceData = {
    id: guard.id,
    full_name: guard.full_name,
    sia_verified: guard.sia_verified,
    sia_expiry_date: guard.sia_expiry_date,
    sia_licence_number: guard.sia_licence_number,
    licence_types: guard.licence_types,
    sia_licence_front_url: guard.sia_licence_front_url || null,
    sia_licence_back_url: guard.sia_licence_back_url || null,
    profile_completed: guard.profile_completed || null,
    verification_status: guard.verification_status || null,
    certifications: guard.certifications || null,
    sia_verified_at: guard.sia_verified_at || null,
  };

  const compliance = computeComplianceInfo(complianceData, requiredLicenceTypes);

  return (
    <div
      className={`bg-[#111d35] rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
        isSelected ? 'border-teal-500 shadow-md ring-2 ring-teal-500/20' : compliance.needsAttention ? 'border-amber-500/30' : 'border-[#1e2d4d]'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#1e2d4d]">
              {guard.profile_image_url ? (
                <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover object-top" />
              ) : (
                <i className="ri-user-line text-2xl text-slate-500"></i>
              )}
            </div>
            {guard.sia_verified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#111d35]">
                <i className="ri-check-line text-white text-xs"></i>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-slate-200 truncate">{guard.full_name}</h3>
              <button
                onClick={() => onToggleSelect(guard.id)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#162036] text-slate-500 hover:bg-[#1a2642]'
                }`}
              >
                <i className={`${isSelected ? 'ri-check-line' : 'ri-add-line'} text-lg`}></i>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-0.5">{renderStars(guard.rating || 0)}</div>
              <span className="text-sm text-slate-400">
                {guard.rating ? guard.rating.toFixed(1) : 'N/A'}
              </span>
              <span className="text-xs text-slate-500">
                ({guard.total_reviews || 0} reviews)
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2 mb-2">
              <SIAStatusBadge compliance={compliance} size="sm" />
              {guard.years_experience && (
                <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border border-blue-500/25">
                  {guard.years_experience}+ yrs exp
                </span>
              )}
              {guard.has_transport && (
                <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border border-violet-500/25">
                  Own Transport
                </span>
              )}
              {guard.applied_at && (
                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border border-amber-500/25">
                  <i className="ri-star-line mr-0.5"></i>
                  Applied
                </span>
              )}
              {compliance.isFullyCompliant && (
                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border border-emerald-500/25">
                  <i className="ri-shield-check-line mr-0.5"></i>
                  Fully Compliant
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#1e2d4d]">
          <div className="text-center">
            <p className="text-lg font-bold text-teal-400">£{guard.hourly_rate || '—'}</p>
            <p className="text-xs text-slate-500">per hour</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-300">{guard.total_jobs_completed || 0}</p>
            <p className="text-xs text-slate-500">jobs done</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-300">{compliance.overallScore}%</p>
            <p className="text-xs text-slate-500">compliance</p>
          </div>
        </div>

        {guard.licence_types && guard.licence_types.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1.5">SIA Licences</p>
            <div className="flex flex-wrap gap-1">
              {guard.licence_types.slice(0, 3).map((licence, idx) => {
                const isMatched = requiredLicenceTypes?.some(
                  (req) =>
                    licence.toLowerCase().includes(req.toLowerCase()) ||
                    req.toLowerCase().includes(licence.toLowerCase())
                );
                return (
                  <span key={idx} className={`px-2 py-0.5 rounded text-xs whitespace-nowrap border ${
                    isMatched
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-[#162036] text-slate-400 border-[#1e2d4d]'
                  }`}>
                    {isMatched && <i className="ri-check-line mr-0.5 text-emerald-400"></i>}
                    {licence}
                  </span>
                );
              })}
              {guard.licence_types.length > 3 && (
                <span className="bg-[#162036] text-slate-400 px-2 py-0.5 rounded text-xs whitespace-nowrap border border-[#1e2d4d]">
                  +{guard.licence_types.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {compliance.licenceMatchStatus === "mismatch" && (
          <div className="mt-3 bg-orange-500/10 border border-orange-500/25 rounded-lg p-2">
            <p className="text-xs text-orange-400 flex items-center gap-1">
              <i className="ri-file-warning-line"></i>
              Licence type does not match job requirements
            </p>
          </div>
        )}

        {compliance.needsAttention && (
          <div className="mt-3 space-y-1">
            {compliance.attentionReasons.slice(0, 2).map((reason, i) => (
              <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                <i className="ri-error-warning-line text-[10px]"></i>
                {reason}
              </p>
            ))}
            {compliance.attentionReasons.length > 2 && (
              <p className="text-xs text-slate-500">
                +{compliance.attentionReasons.length - 2} more issues
              </p>
            )}
          </div>
        )}

        {guard.cover_message && (
          <div className="mt-3 pt-3 border-t border-[#1e2d4d]">
            <p className="text-xs text-slate-500 mb-1">Cover Message</p>
            <p className="text-sm text-slate-400 line-clamp-2">{guard.cover_message}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onViewProfile(guard)}
            className="flex-1 bg-[#162036] text-slate-300 py-2.5 rounded-lg hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-line mr-1.5"></i>
            View Profile
          </button>
          <button
            onClick={() => onToggleSelect(guard.id)}
            className={`flex-1 py-2.5 rounded-lg transition-colors text-sm font-medium cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-teal-500 text-white hover:bg-teal-600'
            }`}
          >
            {isSelected ? (
              <>
                <i className="ri-close-line mr-1.5"></i>
                Deselect
              </>
            ) : (
              <>
                <i className="ri-check-line mr-1.5"></i>
                Select
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}