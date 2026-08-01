"use client";

import { useEffect } from "react";

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
  has_transport: boolean | null;
  availability_status: string | null;
  languages: string[] | null;
  distance_km: number | null;
  cover_message: string | null;
  applied_at: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
}

interface Props {
  guards: Guard[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onMessage: (guard: Guard) => void;
  onViewProfile: (guard: Guard) => void;
  selectedGuardIds: Set<string>;
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
          } text-sm`}
        ></i>
      ))}
    </div>
  );
}

function getSIAStatus(expiryDate: string | null) {
  if (!expiryDate) return { text: "No expiry date", color: "text-slate-500" };
  const now = new Date();
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Expired", color: "text-red-400" };
  if (days <= 30) return { text: `Expires in ${days}d`, color: "text-amber-400" };
  return { text: "Valid", color: "text-emerald-400" };
}

function CompareRow({ label, values, highlightBest }: { label: string; values: React.ReactNode[]; highlightBest?: boolean }) {
  return (
    <div className="grid gap-0" style={{ gridTemplateColumns: `200px repeat(${values.length}, minmax(220px, 1fr))` }}>
      <div className="px-4 py-3 text-sm font-medium text-slate-400 border-b border-r border-[#1e2d4d] flex items-center bg-[#0d1526]">
        {label}
      </div>
      {values.map((val, i) => (
        <div key={i} className="px-4 py-3 text-sm text-slate-300 border-b border-r border-[#1e2d4d] flex items-center min-w-[220px]">
          {val}
        </div>
      ))}
    </div>
  );
}

export default function CompareGuardsModal({ guards, onClose, onRemove, onSelect, onMessage, onViewProfile, selectedGuardIds }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (guards.length === 0) return null;

  const maxRate = Math.max(...guards.map((g) => g.hourly_rate || 0));
  const maxExp = Math.max(...guards.map((g) => g.years_experience || 0));
  const maxRating = Math.max(...guards.map((g) => g.rating || 0));
  const minDist = Math.min(...guards.map((g) => g.distance_km ?? Infinity));
  const maxJobs = Math.max(...guards.map((g) => g.total_jobs_completed || 0));

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#0B1933] rounded-2xl border border-[#1e2d4d] w-full max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4d] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center border border-teal-500/25">
              <i className="ri-arrow-left-right-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compare Guards</h2>
              <p className="text-xs text-slate-500">Side-by-side comparison of shortlisted guards</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{guards.length} selected</span>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-slate-400 text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <div className="grid gap-0 sticky top-0 z-10 bg-[#0B1933]" style={{ gridTemplateColumns: `200px repeat(${guards.length}, minmax(220px, 1fr))` }}>
              <div className="px-4 py-4 text-sm font-semibold text-slate-500 border-b border-r border-[#1e2d4d] bg-[#0B1933]">
                Guard
              </div>
              {guards.map((guard) => (
                <div key={guard.id} className="px-4 py-4 border-b border-r border-[#1e2d4d] bg-[#0B1933] min-w-[220px]">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#162036] flex items-center justify-center overflow-hidden border border-[#1e2d4d]">
                        {guard.profile_image_url ? (
                          <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <i className="ri-user-line text-xl text-slate-500"></i>
                        )}
                      </div>
                      {guard.sia_verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border border-[#0B1933]">
                          <i className="ri-check-line text-white text-[8px]"></i>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{guard.full_name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <StarRating rating={guard.rating || 0} />
                        <span className="text-xs text-slate-400">{guard.rating ? guard.rating.toFixed(1) : "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onViewProfile(guard)}
                      className="flex-1 bg-[#162036] text-slate-300 py-1.5 rounded text-xs font-medium hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-user-line mr-1"></i>Profile
                    </button>
                    <button
                      onClick={() => onMessage(guard)}
                      className="flex-1 bg-[#162036] text-slate-300 py-1.5 rounded text-xs font-medium hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-message-3-line mr-1"></i>Message
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onSelect(guard.id)}
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        selectedGuardIds.has(guard.id)
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          : "bg-teal-500 text-white hover:bg-teal-600"
                      }`}
                    >
                      <i className={`${selectedGuardIds.has(guard.id) ? "ri-close-line" : "ri-check-line"} mr-1`}></i>
                      {selectedGuardIds.has(guard.id) ? "Deselect" : "Select"}
                    </button>
                    <button
                      onClick={() => onRemove(guard.id)}
                      className="flex-1 bg-red-500/10 text-red-400 py-1.5 rounded text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25"
                    >
                      <i className="ri-close-line mr-1"></i>Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <CompareRow
              label="Hourly Rate"
              values={guards.map((g) => (
                <span className={`font-semibold ${(g.hourly_rate || 0) === maxRate ? "text-teal-400" : "text-slate-300"}`}>
                  £{g.hourly_rate || "—"}
                  {(g.hourly_rate || 0) === maxRate && <i className="ri-arrow-up-line ml-1 text-teal-400"></i>}
                </span>
              ))}
            />

            <CompareRow
              label="Experience"
              values={guards.map((g) => (
                <span className={`${(g.years_experience || 0) === maxExp ? "text-teal-400 font-semibold" : "text-slate-300"}`}>
                  {g.years_experience ? `${g.years_experience} years` : "—"}
                  {(g.years_experience || 0) === maxExp && g.years_experience ? <i className="ri-arrow-up-line ml-1 text-teal-400"></i> : null}
                </span>
              ))}
            />

            <CompareRow
              label="Rating"
              values={guards.map((g) => (
                <div className="flex items-center gap-2">
                  <StarRating rating={g.rating || 0} />
                  <span className={`text-sm ${(g.rating || 0) === maxRating ? "text-teal-400 font-semibold" : "text-slate-300"}`}>
                    {g.rating ? g.rating.toFixed(1) : "—"}
                  </span>
                  {(g.rating || 0) === maxRating && g.rating ? <span className="text-[10px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded border border-teal-500/25">Top</span> : null}
                </div>
              ))}
            />

            <CompareRow
              label="Reviews"
              values={guards.map((g) => (
                <span className="text-slate-300">{g.total_reviews || 0} reviews</span>
              ))}
            />

            <CompareRow
              label="Jobs Completed"
              values={guards.map((g) => (
                <span className={`${(g.total_jobs_completed || 0) === maxJobs ? "text-teal-400 font-semibold" : "text-slate-300"}`}>
                  {g.total_jobs_completed || 0}
                  {(g.total_jobs_completed || 0) === maxJobs && g.total_jobs_completed ? <i className="ri-arrow-up-line ml-1 text-teal-400"></i> : null}
                </span>
              ))}
            />

            <CompareRow
              label="SIA Verified"
              values={guards.map((g) => (
                <span className={`flex items-center gap-1.5 ${g.sia_verified ? "text-emerald-400" : "text-red-400"}`}>
                  <i className={`${g.sia_verified ? "ri-shield-check-line" : "ri-close-circle-line"}`}></i>
                  {g.sia_verified ? "Verified" : "Not Verified"}
                </span>
              ))}
            />

            <CompareRow
              label="SIA Expiry"
              values={guards.map((g) => {
                const status = getSIAStatus(g.sia_expiry_date);
                return (
                  <span className={`${status.color}`}>
                    {g.sia_expiry_date
                      ? new Date(g.sia_expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                    {g.sia_expiry_date && <span className="ml-1 text-xs">({status.text})</span>}
                  </span>
                );
              })}
            />

            <CompareRow
              label="SIA Badge No"
              values={guards.map((g) => (
                <span className="text-slate-300 font-mono text-xs">{g.sia_licence_number || "—"}</span>
              ))}
            />

            <CompareRow
              label="Licence Types"
              values={guards.map((g) => (
                <div className="flex flex-wrap gap-1">
                  {g.licence_types && g.licence_types.length > 0 ? (
                    g.licence_types.map((lic, i) => (
                      <span key={i} className="bg-[#162036] text-slate-400 px-2 py-0.5 rounded text-xs border border-[#1e2d4d]">
                        {lic}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              ))}
            />

            <CompareRow
              label="Distance"
              values={guards.map((g) => (
                <span className={`${(g.distance_km ?? Infinity) === minDist ? "text-teal-400 font-semibold" : "text-slate-300"}`}>
                  {g.distance_km !== null ? `${g.distance_km.toFixed(1)} km` : "—"}
                  {(g.distance_km ?? Infinity) === minDist && g.distance_km !== null ? <i className="ri-arrow-up-line ml-1 text-teal-400"></i> : null}
                </span>
              ))}
            />

            <CompareRow
              label="Location"
              values={guards.map((g) => (
                <span className="text-slate-300">{g.location || "—"}</span>
              ))}
            />

            <CompareRow
              label="Postcode"
              values={guards.map((g) => (
                <span className="text-slate-300 font-mono text-xs">{g.postcode || "—"}</span>
              ))}
            />

            <CompareRow
              label="Availability"
              values={guards.map((g) => (
                <span className="text-slate-300">{g.availability_status || "—"}</span>
              ))}
            />

            <CompareRow
              label="Transport"
              values={guards.map((g) => (
                <span className={`flex items-center gap-1.5 ${g.has_transport ? "text-emerald-400" : "text-slate-500"}`}>
                  <i className={`${g.has_transport ? "ri-car-line" : "ri-walk-line"}`}></i>
                  {g.has_transport ? "Has transport" : "No transport"}
                </span>
              ))}
            />

            <CompareRow
              label="Languages"
              values={guards.map((g) => (
                <div className="flex flex-wrap gap-1">
                  {g.languages && g.languages.length > 0 ? (
                    g.languages.map((lang, i) => (
                      <span key={i} className="bg-[#162036] text-slate-400 px-2 py-0.5 rounded text-xs border border-[#1e2d4d]">
                        {lang}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              ))}
            />

            <CompareRow
              label="Specializations"
              values={guards.map((g) => (
                <div className="flex flex-wrap gap-1">
                  {g.specializations && g.specializations.length > 0 ? (
                    g.specializations.map((spec, i) => (
                      <span key={i} className="bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded text-xs border border-teal-500/25">
                        {spec}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              ))}
            />

            <CompareRow
              label="Bio"
              values={guards.map((g) => (
                <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">
                  {g.bio || "—"}
                </p>
              ))}
            />

            <CompareRow
              label="Applied"
              values={guards.map((g) => (
                <span className="text-slate-400 text-xs">
                  {g.applied_at
                    ? new Date(g.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                    : "—"}
                </span>
              ))}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1e2d4d] flex-shrink-0 bg-[#0B1933]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              <i className="ri-information-line mr-1 text-slate-600"></i>
              Green highlights indicate the best value in each category
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="bg-[#162036] text-slate-300 px-5 py-2.5 rounded-lg hover:bg-[#1a2642] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}