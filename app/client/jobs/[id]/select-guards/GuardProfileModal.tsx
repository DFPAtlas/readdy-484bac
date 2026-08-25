"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeComplianceInfo, GuardComplianceData } from "../compliance/useCompliance";
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
  specializations: string[] | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  availability_status: string | null;
  has_transport: boolean | null;
  languages: string[] | null;
  cover_message: string | null;
  applied_at: string | null;
  distance_km: number | null;
  user_id?: string | null;
  profile_completed?: boolean | null;
  verification_status?: string | null;
  certifications?: string[] | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  sia_verified_at?: string | null;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

interface Props {
  guard: Guard;
  isSelected: boolean;
  isShortlisted: boolean;
  onClose: () => void;
  onToggleSelect: () => void;
  onToggleShortlist: () => void;
  onMessage: () => void;
  guardsRequired: number;
  guardsSelected: number;
  requiredLicenceTypes?: string[] | null;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = rating >= s;
        return (
          <span key={s} className={`text-base ${filled ? "text-amber-400" : "text-slate-600"}`}>
            {filled ? "★" : "☆"}
          </span>
        );
      })}
    </div>
  );
}

function SIAExpiryWarning({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3 flex items-center gap-2">
        <i className="ri-error-warning-line text-red-400"></i>
        <span className="text-sm text-red-400">SIA licence expired on {expiry.toLocaleDateString("en-GB")}</span>
      </div>
    );
  }
  if (days <= 30) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 flex items-center gap-2">
        <i className="ri-time-line text-amber-400"></i>
        <span className="text-sm text-amber-400">SIA licence expires in {days} day{days !== 1 ? "s" : ""}</span>
      </div>
    );
  }
  return null;
}

export default function GuardProfileModal({
  guard,
  isSelected,
  isShortlisted,
  onClose,
  onToggleSelect,
  onToggleShortlist,
  onMessage,
  guardsRequired,
  guardsSelected,
  requiredLicenceTypes,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const canSelect = !isSelected && guardsSelected < guardsRequired;

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

  useEffect(() => {
    const fetchReviews = async () => {
      setReviewsLoading(true);
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, review_text, created_at")
        .eq("guard_id", guard.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(5);
      setReviews(data || []);
      setReviewsLoading(false);
    };
    fetchReviews();
  }, [guard.id]);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <i
          key={i}
          className={`${i <= Math.round(rating) ? "ri-star-fill text-yellow-400" : "ri-star-line text-slate-600"} text-lg`}
        ></i>
      );
    }
    return stars;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-[#162036] to-[#1a2642] p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-[#1e2d4d]/50 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>

          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-[#1e2d4d]">
              {guard.profile_image_url ? (
                <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover object-top" />
              ) : (
                <i className="ri-user-line text-3xl text-slate-500"></i>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{guard.full_name}</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-0.5">{renderStars(guard.rating || 0)}</div>
                <span className="text-white/80 text-sm">
                  {guard.rating ? guard.rating.toFixed(1) : "N/A"} ({guard.total_reviews || 0} reviews)
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {guard.sia_verified && (
                  <span className="bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border border-emerald-500/25">
                    <i className="ri-shield-check-line mr-1"></i>SIA Verified
                  </span>
                )}
                {guard.location && (
                  <span className="text-white/70 text-sm">
                    <i className="ri-map-pin-line mr-1"></i>{guard.location}
                  </span>
                )}
                {guard.distance_km !== null && (
                  <span className="text-white/70 text-sm">
                    <i className="ri-route-line mr-1"></i>{guard.distance_km.toFixed(1)} km away
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <SIAExpiryWarning expiryDate={guard.sia_expiry_date} />

          <GuardComplianceSummary compliance={compliance} />

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#162036] rounded-xl p-4 text-center border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-teal-400">£{guard.hourly_rate || "—"}</p>
              <p className="text-xs text-slate-500 mt-1">Hourly Rate</p>
            </div>
            <div className="bg-[#162036] rounded-xl p-4 text-center border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-slate-300">{guard.total_jobs_completed || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Jobs Completed</p>
            </div>
            <div className="bg-[#162036] rounded-xl p-4 text-center border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-slate-300">{guard.years_experience || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Years Exp.</p>
            </div>
            <div className="bg-[#162036] rounded-xl p-4 text-center border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-slate-300">{guard.rating ? guard.rating.toFixed(1) : "—"}</p>
              <p className="text-xs text-slate-500 mt-1">Avg Rating</p>
            </div>
          </div>

          <div className="mb-6 bg-[#162036] border border-[#1e2d4d] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <i className="ri-star-fill text-amber-400"></i>
              Ratings & Reviews
            </h3>
            {guard.total_reviews && guard.total_reviews > 0 ? (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-white">{(guard.rating!).toFixed(1)}</p>
                  <StarRow rating={guard.rating!} />
                  <p className="text-xs text-slate-500 mt-1">{guard.total_reviews} review{guard.total_reviews !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length;
                    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-4 text-right">{star}</span>
                        <i className="ri-star-fill text-amber-400 text-xs"></i>
                        <div className="flex-1 bg-[#1e2d4d] rounded-full h-1.5">
                          <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500 w-6">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No reviews yet</p>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Recent Reviews</h3>
            {reviewsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <i className="ri-loader-4-line animate-spin"></i>
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No published reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <StarRow rating={review.rating} />
                      <span className="text-xs text-slate-500">
                        {new Date(review.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-slate-400 leading-relaxed">{review.review_text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {guard.bio && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">About</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{guard.bio}</p>
            </div>
          )}

          {guard.cover_message && (
            <div className="mb-6 bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
              <h3 className="text-sm font-semibold text-teal-400 mb-2">
                <i className="ri-message-3-line mr-1.5"></i>Application Message
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{guard.cover_message}</p>
              {guard.applied_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Applied {new Date(guard.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {guard.licence_types && guard.licence_types.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">SIA Licences</h3>
                <div className="flex flex-wrap gap-2">
                  {guard.licence_types.map((licence, idx) => (
                    <span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                      requiredLicenceTypes?.some(
                        (req) =>
                          licence.toLowerCase().includes(req.toLowerCase()) ||
                          req.toLowerCase().includes(licence.toLowerCase())
                      )
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                    }`}>
                      <i className="ri-shield-check-line mr-1"></i>{licence}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {guard.specializations && guard.specializations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Specializations</h3>
                <div className="flex flex-wrap gap-2">
                  {guard.specializations.map((spec, idx) => (
                    <span key={idx} className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border border-blue-500/25">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {guard.languages && guard.languages.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {guard.languages.map((lang, idx) => (
                    <span key={idx} className="bg-[#162036] text-slate-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border border-[#1e2d4d]">
                      <i className="ri-translate-2 mr-1"></i>{lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Details</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <i className="ri-car-line text-slate-500"></i>
                  <span>{guard.has_transport ? "Has own transport" : "No own transport"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <i className="ri-calendar-check-line text-slate-500"></i>
                  <span>{guard.availability_status || "Flexible"} availability</span>
                </div>
                {guard.postcode && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <i className="ri-map-pin-2-line text-slate-500"></i>
                    <span>{guard.postcode}</span>
                  </div>
                )}
                {guard.sia_licence_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <i className="ri-shield-check-line text-emerald-400"></i>
                    <span>SIA Badge: {guard.sia_licence_number}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[#1e2d4d]">
            <button
              onClick={onClose}
              className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-xl hover:bg-[#1a2642] transition-colors font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
            >
              Close
            </button>
            <button
              onClick={onToggleShortlist}
              className={`flex-1 py-3 rounded-xl transition-colors font-medium cursor-pointer whitespace-nowrap ${
                isShortlisted
                  ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/25"
                  : "bg-[#162036] text-slate-300 hover:bg-[#1a2642] border border-[#1e2d4d]"
              }`}
            >
              <i className={`${isShortlisted ? "ri-bookmark-fill" : "ri-bookmark-line"} mr-1.5`}></i>
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </button>
            <button
              onClick={onMessage}
              className="flex-1 bg-[#162036] text-slate-300 py-3 rounded-xl hover:bg-[#1a2642] transition-colors font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
            >
              <i className="ri-message-3-line mr-1.5"></i>
              Message
            </button>
            <button
              onClick={() => {
                onToggleSelect();
                if (isSelected) onClose();
              }}
              disabled={!isSelected && !canSelect}
              className={`flex-1 py-3 rounded-xl transition-colors font-medium cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/25"
                  : canSelect
                  ? "bg-teal-500 text-white hover:bg-teal-600"
                  : "bg-[#162036] text-slate-600 border border-[#1e2d4d] cursor-not-allowed"
              }`}
            >
              <i className={`${isSelected ? "ri-close-line" : "ri-check-line"} mr-1.5`}></i>
              {isSelected ? "Deselect" : "Select"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}