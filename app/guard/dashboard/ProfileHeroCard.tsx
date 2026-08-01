'use client';

import Link from 'next/link';
import { Guard } from './types';

interface Props {
  guard: Guard | null;
  onAvailabilityToggle?: () => void;
  planName?: string;
  subscriptionStatus?: string;
}

function getAvailability(guard: Guard | null) {
  if (!guard) return { label: 'Offline', color: 'red', dot: 'bg-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' };
  if (guard.is_active && guard.accepts_direct_bookings) return { label: 'Available', color: 'emerald', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' };
  if (guard.is_active && !guard.accepts_direct_bookings) return { label: 'Busy', color: 'amber', dot: 'bg-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' };
  return { label: 'Offline', color: 'red', dot: 'bg-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' };
}

function getProfileCompletion(guard: Guard | null): number {
  if (!guard) return 0;
  let score = 0;
  if (guard.full_name) score += 15;
  if (guard.email) score += 15;
  if (guard.profile_image_url) score += 15;
  if (guard.location) score += 15;
  if (guard.postcode) score += 15;
  if (guard.years_experience !== null) score += 15;
  if (guard.sia_licence_front_url) score += 10;
  return score;
}

function getSIAStatus(guard: Guard | null) {
  if (!guard?.sia_licence_front_url) return { label: 'Not Uploaded', color: 'red', icon: 'ri-close-circle-line' };
  if (guard?.sia_expiry_date) {
    const days = Math.floor((new Date(guard.sia_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Expired', color: 'red', icon: 'ri-error-warning-line' };
    if (days <= 60) return { label: `${days} days left`, color: 'amber', icon: 'ri-time-line' };
  }
  return { label: 'Valid', color: 'emerald', icon: 'ri-shield-check-line' };
}

function getVerificationBadge(status: string | null) {
  if (!status || status === 'pending') return { label: 'Pending', color: 'amber', icon: 'ri-time-line' };
  if (status === 'approved') return { label: 'Verified', color: 'emerald', icon: 'ri-checkbox-circle-fill' };
  if (status === 'rejected') return { label: 'Rejected', color: 'red', icon: 'ri-close-circle-fill' };
  return { label: 'Unknown', color: 'slate', icon: 'ri-question-line' };
}

export default function ProfileHeroCard({ guard, onAvailabilityToggle, planName, subscriptionStatus }: Props) {
  if (!guard) return null;

  const initials = guard.full_name
    ? guard.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'GU';
  const availability = getAvailability(guard);
  const completion = getProfileCompletion(guard);
  const sia = getSIAStatus(guard);
  const verification = getVerificationBadge(guard.verification_status);

  return (
    <div className="bg-[#0d1b36] rounded-2xl border border-[#1a2b4a] shadow-xl shadow-black/20 p-5 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center overflow-hidden ring-4 ring-[#0B1933] shadow-lg">
              {guard.profile_image_url ? (
                <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-white">{initials}</span>
              )}
            </div>
            <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${availability.dot} ring-2 ring-[#0B1933]`} />
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${availability.bg} ${availability.border} ${availability.text}`}>
            <span className={`w-2 h-2 rounded-full ${availability.dot}`}></span>
            {availability.label}
          </div>
          {planName && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : subscriptionStatus === 'past_due' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <i className="ri-vip-crown-line"></i>
              {planName}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{guard.full_name}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${verification.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : verification.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  <i className={`${verification.icon} text-xs`}></i>
                  {verification.label}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                {guard.location || 'Location not set'}
                {guard.years_experience ? ` · ${guard.years_experience} years exp` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/guard/profile"
                className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-teal-500/20"
              >
                Edit Profile
              </Link>
              {onAvailabilityToggle && (
                <button
                  onClick={onAvailabilityToggle}
                  className="px-4 py-2 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-medium hover:bg-[#162036] transition-all cursor-pointer whitespace-nowrap"
                >
                  Availability
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-star-fill text-amber-400 text-sm"></i>
                <span className="text-xs text-slate-500">Rating</span>
              </div>
              <p className="text-lg font-bold text-white">
                {guard.rating ? guard.rating.toFixed(1) : '—'}
                {guard.total_reviews ? <span className="text-xs text-slate-500 font-normal ml-1">({guard.total_reviews})</span> : null}
              </p>
            </div>
            <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-briefcase-line text-teal-400 text-sm"></i>
                <span className="text-xs text-slate-500">Jobs Done</span>
              </div>
              <p className="text-lg font-bold text-white">{guard.total_jobs_completed || 0}</p>
            </div>
            <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <i className={`${sia.icon} ${sia.color === 'emerald' ? 'text-emerald-400' : sia.color === 'amber' ? 'text-amber-400' : 'text-red-400'} text-sm`}></i>
                <span className="text-xs text-slate-500">SIA Licence</span>
              </div>
              <p className={`text-lg font-bold ${sia.color === 'emerald' ? 'text-emerald-400' : sia.color === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{sia.label}</p>
            </div>
            <div className="bg-[#0B1933] rounded-xl border border-[#1a2b4a] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-user-line text-blue-400 text-sm"></i>
                <span className="text-xs text-slate-500">Profile</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-white">{completion}%</p>
              </div>
              <div className="w-full h-1.5 bg-[#1a2b4a] rounded-full mt-1.5">
                <div
                  className={`h-full rounded-full transition-all ${completion >= 80 ? 'bg-emerald-400' : completion >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {guard.sia_licence_number && (
              <span className="flex items-center gap-1">
                <i className="ri-id-card-line"></i>
                SIA: {guard.sia_licence_number}
              </span>
            )}
            {guard.sia_expiry_date && (
              <span className="flex items-center gap-1">
                <i className="ri-calendar-line"></i>
                Expires: {new Date(guard.sia_expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}