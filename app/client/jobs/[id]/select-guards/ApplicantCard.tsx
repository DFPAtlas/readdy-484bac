"use client";

import { computeComplianceInfo, GuardComplianceData } from "../compliance/useCompliance";
import GuardComplianceBadge from "../compliance/GuardComplianceBadge";
import GuardComplianceSummary from "../compliance/GuardComplianceSummary";

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
  availability_status: string | null;
  cover_message: string | null;
  applied_at: string | null;
  distance_km: number | null;
  user_id?: string | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  profile_completed?: boolean | null;
  verification_status?: string | null;
  certifications?: string[] | null;
  sia_verified_at?: string | null;
}

interface ApplicationStatus {
  shortlisted: boolean;
  status: string;
}

interface Props {
  guard: Guard;
  applicationStatus?: ApplicationStatus;
  assignmentStatus?: string;
  isSelected: boolean;
  isShortlisted: boolean;
  isChecked: boolean;
  isCompared: boolean;
  requiredLicenceTypes?: string[] | null;
  onToggleSelect: () => void;
  onToggleShortlist: () => void;
  onToggleCheck: () => void;
  onToggleCompare: () => void;
  onViewProfile: () => void;
  onMessage: () => void;
  onReject: () => void;
  onInvite: () => void;
  guardsRequired: number;
  guardsSelected: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`${
            s <= Math.round(rating)
              ? "ri-star-fill text-amber-400"
              : "ri-star-line text-slate-600"
          } text-xs`}
        ></i>
      ))}
    </div>
  );
}

function StatusBadge({
  isSelected,
  isShortlisted,
  appStatus,
  assignmentStatus,
}: {
  isSelected: boolean;
  isShortlisted: boolean;
  appStatus?: ApplicationStatus;
  assignmentStatus?: string;
}) {
  if (assignmentStatus === "confirmed") {
    return (
      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-500/25">
        <i className="ri-checkbox-circle-line mr-0.5"></i>Confirmed
      </span>
    );
  }
  if (isSelected || assignmentStatus === "pending") {
    return (
      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/25">
        <i className="ri-time-line mr-0.5"></i>Awaiting Confirmation
      </span>
    );
  }
  if (isShortlisted) {
    return (
      <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full text-xs font-medium border border-violet-500/25">
        <i className="ri-bookmark-line mr-0.5"></i>Shortlisted
      </span>
    );
  }
  if (appStatus?.status === "rejected" || appStatus?.status === "declined") {
    return (
      <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-xs font-medium border border-red-500/25">
        <i className="ri-close-circle-line mr-0.5"></i>Declined
      </span>
    );
  }
  if (appStatus?.status === "accepted") {
    return (
      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/25">
        <i className="ri-time-line mr-0.5"></i>Awaiting Confirmation
      </span>
    );
  }
  return (
    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-500/25">
      <i className="ri-sparkling-line mr-0.5"></i>New Applicant
    </span>
  );
}

function SIAWarning({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) {
    return (
      <div className="flex items-center gap-1.5 text-red-400 text-xs mt-1">
        <i className="ri-error-warning-line"></i>
        SIA licence expired
      </div>
    );
  }
  if (daysUntil <= 30) {
    return (
      <div className="flex items-center gap-1.5 text-amber-400 text-xs mt-1">
        <i className="ri-time-line"></i>
        SIA expires in {daysUntil} day{daysUntil !== 1 ? "s" : ""}
      </div>
    );
  }
  return null;
}

export default function ApplicantCard({
  guard,
  applicationStatus,
  assignmentStatus,
  isSelected,
  isShortlisted,
  isChecked,
  isCompared,
  requiredLicenceTypes,
  onToggleSelect,
  onToggleShortlist,
  onToggleCheck,
  onToggleCompare,
  onViewProfile,
  onMessage,
  onReject,
  onInvite,
  guardsRequired,
  guardsSelected,
}: Props) {
  const canSelect = !isSelected && guardsSelected < guardsRequired;
  const isRejected = applicationStatus?.status === "rejected" || applicationStatus?.status === "declined";

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
        isSelected
          ? "border-teal-500 shadow-md ring-2 ring-teal-500/20"
          : isShortlisted
          ? "border-violet-500/50"
          : compliance.needsAttention
          ? "border-amber-500/30"
          : "border-[#1e2d4d]"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
                {guard.profile_image_url ? (
                  <img
                    src={guard.profile_image_url}
                    alt={guard.full_name}
                    className="w-full h-full object-cover object-top"
                  />
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
            <div className="flex flex-col items-center gap-1.5">
              <label className="w-5 h-5 flex items-center justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={onToggleCheck}
                  className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
                />
              </label>
              <button
                onClick={onToggleCompare}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                  isCompared
                    ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                    : "bg-[#162036] text-slate-500 border border-[#1e2d4d] hover:text-slate-300"
                }`}
                title={isCompared ? "Remove from comparison" : "Add to comparison"}
              >
                <i className={`${isCompared ? "ri-arrow-left-right-line" : "ri-add-line"} text-sm`}></i>
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-base font-semibold text-slate-200">
                  {guard.full_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <StatusBadge
                    isSelected={isSelected}
                    isShortlisted={isShortlisted}
                    appStatus={applicationStatus}
                    assignmentStatus={assignmentStatus}
                  />
                  <GuardComplianceBadge compliance={compliance} size="sm" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <StarRating rating={guard.rating || 0} />
                <span className="text-sm text-slate-400 ml-1">
                  {guard.rating ? guard.rating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-slate-500">
                  ({guard.total_reviews || 0})
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {guard.sia_licence_number && (
                <span className="text-slate-400 flex items-center gap-1">
                  <i className="ri-shield-check-line text-emerald-400 text-xs"></i>
                  SIA {guard.sia_licence_number}
                </span>
              )}
              {guard.years_experience && (
                <span className="text-slate-400 flex items-center gap-1">
                  <i className="ri-briefcase-line text-blue-400 text-xs"></i>
                  {guard.years_experience} yrs exp
                </span>
              )}
              {guard.distance_km !== null && (
                <span className="text-slate-400 flex items-center gap-1">
                  <i className="ri-map-pin-line text-slate-500 text-xs"></i>
                  {guard.distance_km.toFixed(1)} km
                </span>
              )}
              {guard.availability_status && (
                <span className="text-slate-400 flex items-center gap-1">
                  <i className="ri-calendar-check-line text-slate-500 text-xs"></i>
                  {guard.availability_status}
                </span>
              )}
              {guard.has_transport && (
                <span className="text-slate-400 flex items-center gap-1">
                  <i className="ri-car-line text-violet-400 text-xs"></i>
                  Transport
                </span>
              )}
            </div>

            <SIAWarning expiryDate={guard.sia_expiry_date} />

            {guard.licence_types && guard.licence_types.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {guard.licence_types.slice(0, 4).map((lic, i) => {
                  const isMatched = requiredLicenceTypes?.some(
                    (req) =>
                      lic.toLowerCase().includes(req.toLowerCase()) ||
                      req.toLowerCase().includes(lic.toLowerCase())
                  );
                  return (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded text-xs border ${
                        isMatched
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                          : "bg-[#162036] text-slate-400 border-[#1e2d4d]"
                      }`}
                    >
                      {isMatched && <i className="ri-check-line mr-0.5 text-emerald-400"></i>}
                      {lic}
                    </span>
                  );
                })}
                {guard.licence_types.length > 4 && (
                  <span className="bg-[#162036] text-slate-400 px-2 py-0.5 rounded text-xs border border-[#1e2d4d]">
                    +{guard.licence_types.length - 4}
                  </span>
                )}
              </div>
            )}

            {compliance.licenceMatchStatus === "mismatch" && (
              <div className="mt-2 bg-orange-500/10 border border-orange-500/25 rounded-lg p-2">
                <p className="text-xs text-orange-400 flex items-center gap-1">
                  <i className="ri-file-warning-line"></i>
                  Licence type does not match job requirements
                </p>
              </div>
            )}

            {guard.bio && (
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {guard.bio}
              </p>
            )}

            {guard.cover_message && (
              <div className="mt-2 bg-[#162036] rounded-lg p-2.5 border border-[#1e2d4d]">
                <p className="text-xs text-slate-500 mb-1">Cover Message</p>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {guard.cover_message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <p className="text-xs text-slate-500">Hourly Rate</p>
                <p className="text-sm font-semibold text-teal-400">
                  £{guard.hourly_rate || "—"}
                </p>
              </div>
              <div className="bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <p className="text-xs text-slate-500">Jobs Done</p>
                <p className="text-sm font-semibold text-slate-300">
                  {guard.total_jobs_completed || 0}
                </p>
              </div>
              <div className="bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <p className="text-xs text-slate-500">Compliance</p>
                <p className={`text-sm font-semibold ${
                  compliance.overallScore >= 80 ? "text-emerald-400" : compliance.overallScore >= 50 ? "text-amber-400" : "text-red-400"
                }`}>
                  {compliance.overallScore}%
                </p>
              </div>
            </div>
          </div>
        </div>

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

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#1e2d4d]">
          <button
            onClick={onViewProfile}
            className="flex-1 min-w-[100px] bg-[#162036] text-slate-300 py-2.5 rounded-lg hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-line mr-1.5"></i>
            View Profile
          </button>

          <button
            onClick={onMessage}
            className="flex-1 min-w-[100px] bg-[#162036] text-slate-300 py-2.5 rounded-lg hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-message-3-line mr-1.5"></i>
            Message
          </button>

          {!isSelected && !isRejected && (
            <button
              onClick={onToggleShortlist}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg transition-colors text-sm font-medium cursor-pointer whitespace-nowrap ${
                isShortlisted
                  ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/25"
                  : "bg-[#162036] text-slate-300 hover:bg-[#1a2642] border border-[#1e2d4d]"
              }`}
            >
              <i
                className={`${
                  isShortlisted ? "ri-bookmark-fill" : "ri-bookmark-line"
                } mr-1.5`}
              ></i>
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </button>
          )}

          {!isRejected && !isSelected && (
            <button
              onClick={onToggleSelect}
              disabled={!canSelect}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg transition-colors text-sm font-medium cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : canSelect
                  ? "bg-teal-500 text-white hover:bg-teal-600"
                  : "bg-[#162036] text-slate-600 border border-[#1e2d4d] cursor-not-allowed"
              }`}
            >
              <i
                className={`${
                  isSelected ? "ri-close-line" : "ri-check-line"
                } mr-1.5`}
              ></i>
              {isSelected ? "Deselect" : "Select"}
            </button>
          )}

          {!isSelected && !isRejected && (
            <button
              onClick={onReject}
              className="flex-1 min-w-[100px] bg-red-500/10 text-red-400 py-2.5 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap border border-red-500/25"
            >
              <i className="ri-close-circle-line mr-1.5"></i>
              Reject
            </button>
          )}

          {!isSelected && !isRejected && !guard.applied_at && (
            <button
              onClick={onInvite}
              className="flex-1 min-w-[100px] bg-blue-500/10 text-blue-400 py-2.5 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap border border-blue-500/25"
            >
              <i className="ri-send-plane-line mr-1.5"></i>
              Invite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}