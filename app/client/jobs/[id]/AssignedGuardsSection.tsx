'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { computeComplianceInfo, GuardComplianceData } from './compliance/useCompliance';
import { SIAStatusBadge } from './compliance/GuardComplianceBadge';
import ReviewStatusBadge, { ReviewStars, GuardRatingSummary } from '@/components/reviews/ReviewStatusBadge';

interface Guard {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  sia_licence_number?: string;
  phone?: string;
  user_id?: string;
  sia_verified?: boolean;
  sia_expiry_date?: string | null;
  licence_types?: string[] | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  profile_completed?: boolean | null;
  verification_status?: string | null;
  certifications?: string[] | null;
  sia_verified_at?: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  total_jobs_completed?: number | null;
}

interface Assignment {
  id: string;
  guards: Guard;
  created_at: string;
  status?: string;
}

interface GuardReview {
  id: string;
  guard_id: string;
  rating: number;
  review_text?: string;
  review_status: string;
  issue_reported: boolean;
  punctuality?: number | null;
  professionalism?: number | null;
  communication?: number | null;
  appearance?: number | null;
  reliability?: number | null;
  created_at: string;
}

interface AssignedGuardsSectionProps {
  guards: Assignment[];
  isCompleted?: boolean;
  jobId?: string;
  onLeaveReview?: (guardId: string, guardName: string) => void;
  onMessageGuard?: (guardId: string, guardName: string, guardUserId: string) => void;
  requiredLicenceTypes?: string[] | null;
}

export default function AssignedGuardsSection({
  guards,
  isCompleted = false,
  jobId,
  onLeaveReview,
  onMessageGuard,
  requiredLicenceTypes,
}: AssignedGuardsSectionProps) {
  const router = useRouter();
  const [guardReviews, setGuardReviews] = useState<Record<string, GuardReview>>({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || guards.length === 0) return;
    loadGuardReviews();
  }, [jobId, guards.length]);

  const loadGuardReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('job_id', jobId)
        .eq('client_id', user.id);

      const map: Record<string, GuardReview> = {};
      (reviews || []).forEach((r) => {
        if (r.guard_id) map[r.guard_id] = r;
      });
      setGuardReviews(map);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleMessage = (guard: Guard) => {
    if (onMessageGuard && guard.user_id) {
      onMessageGuard(guard.id, guard.full_name || 'Guard', guard.user_id);
    } else {
      router.push('/client/messages');
    }
  };

  if (guards.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-16 text-center">
        <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-shield-user-line text-3xl text-slate-600"></i>
        </div>
        <h3 className="text-base font-semibold text-slate-300 mb-1">No guards assigned yet</h3>
        <p className="text-sm text-slate-500">Guards will appear here once they have been selected for this job.</p>
      </div>
    );
  }

  const unreviewedCount = guards.filter((a) => !guardReviews[a.guards?.id]).length;
  const reviewedCount = guards.filter((a) => guardReviews[a.guards?.id]).length;

  // Attendance stats
  const checkedInCount = guards.filter(a => a.attendance_status === 'checked_in' || a.attendance_status === 'checked_out' || a.attendance_status === 'completed').length;
  const lateCount = guards.filter(a => a.attendance_status === 'late').length;
  const noShowCount = guards.filter(a => a.attendance_status === 'no_show').length;
  const issueCount = guards.filter(a => a.issue_reported).length;

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className="ri-shield-user-line text-teal-400 text-lg"></i>
          </div>
          Assigned Guards
          <span className="ml-1 bg-teal-500/15 text-teal-400 text-xs font-bold px-2 py-0.5 rounded-full">{guards.length}</span>
        </h2>
        {isCompleted && reviewedCount < guards.length && (
          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
            {unreviewedCount} awaiting review
          </span>
        )}
        {guards.length > 1 && jobId && (
          <button
            onClick={() => router.push('/client/messages')}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-message-3-line"></i>
            Message All
          </button>
        )}
      </div>

      {isCompleted && reviewedCount < guards.length && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-lg shrink-0">
            <i className="ri-star-line text-amber-400 text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-400">Guards awaiting your review</p>
            <p className="text-xs text-amber-400/80">
              {unreviewedCount} of {guards.length} still need{unreviewedCount === 1 ? 's' : ''} feedback. Your reviews help other clients make better hiring decisions.
            </p>
          </div>
        </div>
      )}

      {/* Attendance Stats Banner */}
      {(checkedInCount > 0 || lateCount > 0 || noShowCount > 0 || issueCount > 0) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {checkedInCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <i className="ri-login-box-line"></i>
              {checkedInCount} checked in
            </span>
          )}
          {lateCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <i className="ri-time-line"></i>
              {lateCount} late
            </span>
          )}
          {noShowCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <i className="ri-user-unfollow-line"></i>
              {noShowCount} no-show
            </span>
          )}
          {issueCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <i className="ri-error-warning-line"></i>
              {issueCount} issue{issueCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guards.map((assignment) => {
          const g = assignment.guards;
          const initials = g
            ? g.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()
            : '??';
          const guardName = g ? g.full_name : 'Unknown Guard';
          const review = g?.id ? guardReviews[g.id] : undefined;

          const complianceData: GuardComplianceData = {
            id: g?.id || '',
            full_name: g?.full_name || '',
            sia_verified: g?.sia_verified || false,
            sia_expiry_date: g?.sia_expiry_date || null,
            sia_licence_number: g?.sia_licence_number || null,
            licence_types: g?.licence_types || null,
            sia_licence_front_url: g?.sia_licence_front_url || null,
            sia_licence_back_url: g?.sia_licence_back_url || null,
            profile_completed: g?.profile_completed || null,
            verification_status: g?.verification_status || null,
            certifications: g?.certifications || null,
            sia_verified_at: g?.sia_verified_at || null,
          };

          const compliance = computeComplianceInfo(complianceData, requiredLicenceTypes);

          return (
            <div key={assignment.id} className="flex flex-col gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#111d35] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                  {g?.profile_photo_url ? (
                    <img src={g.profile_photo_url} alt={initials} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-teal-400 font-bold text-sm">{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-200 truncate">{guardName}</p>
                  {g?.sia_licence_number && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <i className="ri-shield-check-line text-emerald-400"></i>
                      SIA: {g.sia_licence_number}
                    </p>
                  )}
                  {g?.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <i className="ri-phone-line text-slate-600"></i>
                      {g.phone}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {assignment.status === 'confirmed' ? 'Confirmed' : 'Assigned'}
                  </span>
                  {assignment.attendance_status && (
                    <AttendanceBadge status={assignment.attendance_status} />
                  )}
                  {isCompleted && (
                    <ReviewStatusBadge
                      status={review ? review.review_status || 'reviewed' : 'awaiting_review'}
                      rating={review?.rating}
                      issueReported={review?.issue_reported}
                      compact
                    />
                  )}
                </div>
              </div>

              {/* Guard Rating Summary */}
              {(g?.average_rating && g.average_rating > 0) && (
                <div className="flex items-center gap-2">
                  <GuardRatingSummary
                    averageRating={g.average_rating}
                    totalReviews={g.total_reviews}
                    completedJobs={g.total_jobs_completed}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <SIAStatusBadge compliance={compliance} size="sm" />
                {compliance.isFullyCompliant && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-shield-check-line"></i>
                    Fully Compliant
                  </span>
                )}
                {assignment.attendance_status === 'no_show' && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-user-unfollow-line"></i>
                    No-Show
                  </span>
                )}
                {assignment.attendance_status === 'late' && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    {assignment.late_minutes ? `${assignment.late_minutes}m Late` : 'Late'}
                  </span>
                )}
                {assignment.attendance_status === 'checked_in' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-login-box-line"></i>
                    Checked In
                  </span>
                )}
                {assignment.attendance_status === 'checked_out' && (
                  <span className="bg-violet-500/10 text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-logout-box-line"></i>
                    Checked Out
                  </span>
                )}
                {assignment.issue_reported && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    Issue Reported
                  </span>
                )}
                {compliance.licenceMatchStatus === 'mismatch' && (
                  <span className="bg-orange-500/10 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-file-warning-line"></i>
                    Licence Mismatch
                  </span>
                )}
                {compliance.siaStatus === 'expiring_soon' && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    Expiring Soon
                  </span>
                )}
                {compliance.siaStatus === 'expired' && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    SIA Expired
                  </span>
                )}
                {compliance.siaStatus === 'missing' && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-file-close-line"></i>
                    Missing Licence
                  </span>
                )}
                {compliance.siaStatus === 'pending' && (
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <i className="ri-loader-4-line"></i>
                    Pending Review
                  </span>
                )}
              </div>

              {/* Review Details */}
              {review && (
                <div className="bg-[#111d35] rounded-lg border border-[#1e2d4d] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Your rating</span>
                      <ReviewStars rating={review.rating} size="sm" />
                    </div>
                    <button
                      onClick={() => setShowReviewDetails(showReviewDetails === review.id ? null : review.id)}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                    >
                      {showReviewDetails === review.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {showReviewDetails === review.id && (
                    <div className="space-y-1 pt-1 border-t border-[#1e2d4d]">
                      {review.punctuality && <p className="text-xs text-slate-500">Punctuality: {review.punctuality}/5</p>}
                      {review.professionalism && <p className="text-xs text-slate-500">Professionalism: {review.professionalism}/5</p>}
                      {review.communication && <p className="text-xs text-slate-500">Communication: {review.communication}/5</p>}
                      {review.appearance && <p className="text-xs text-slate-500">Appearance: {review.appearance}/5</p>}
                      {review.reliability && <p className="text-xs text-slate-500">Reliability: {review.reliability}/5</p>}
                      {review.review_text && (
                        <p className="text-xs text-slate-400 italic mt-1">"{review.review_text}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-[#1e2d4d]">
                <button
                  onClick={() => handleMessage(g)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-message-3-line"></i>
                  Message
                </button>
                {g?.phone && (
                  <a
                    href={`tel:${g.phone}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-300 bg-[#111d35] hover:bg-[#1a2642] px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-phone-line"></i>
                    Call
                  </a>
                )}
                {isCompleted && g?.id && (
                  review ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <ReviewStatusBadge
                        status={review.review_status || 'reviewed'}
                        rating={review.rating}
                        issueReported={review.issue_reported}
                        compact
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => onLeaveReview?.(g.id, guardName)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ml-auto"
                    >
                      <i className="ri-star-line"></i>
                      Leave a Review
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loadingReviews && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

function AttendanceBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    awaiting_confirmation: { label: 'Awaiting', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/25', icon: 'ri-time-line' },
    confirmed: { label: 'Confirmed', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', icon: 'ri-check-line' },
    not_checked_in: { label: 'Not Checked In', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/25', icon: 'ri-login-circle-line' },
    checked_in: { label: 'Checked In', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', icon: 'ri-login-box-line' },
    late: { label: 'Late', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', icon: 'ri-time-line' },
    no_show: { label: 'No-Show', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', icon: 'ri-user-unfollow-line' },
    checked_out: { label: 'Checked Out', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', icon: 'ri-logout-box-line' },
    completed: { label: 'Completed', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/25', icon: 'ri-checkbox-circle-line' },
  };
  const cfg = config[status] || config.awaiting_confirmation;
  return (
    <span className={`${cfg.bg} ${cfg.text} ${cfg.border} border text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1`}>
      <i className={cfg.icon}></i>
      {cfg.label}
    </span>
  );
}