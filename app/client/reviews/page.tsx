'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import Link from 'next/link';
import ReviewStatusBadge, { ReviewStars } from '@/components/reviews/ReviewStatusBadge';
import RateGuardModal from '@/components/reviews/RateGuardModal';

interface ReviewItem {
  id: string;
  job_id: string;
  guard_id: string;
  rating: number;
  review_text?: string;
  review_status: string;
  issue_reported: boolean;
  issue_category?: string;
  punctuality?: number | null;
  professionalism?: number | null;
  communication?: number | null;
  appearance?: number | null;
  reliability?: number | null;
  would_hire_again?: boolean | null;
  attendance_status?: string | null;
  site_instructions_followed?: boolean | null;
  created_at: string;
  guards: {
    full_name: string;
    profile_photo_url?: string;
  } | null;
  jobs: {
    job_title: string;
    start_date: string;
  } | null;
}

interface PendingReview {
  job_id: string;
  job_title: string;
  start_date: string;
  guard_id: string;
  guard_name: string;
  profile_photo_url?: string;
}

export default function ClientReviewsPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [companyName, setCompanyName] = useState('Client');
  const [initials, setInitials] = useState('CL');

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ jobId: string; guardId: string; guardName: string; jobTitle: string; startDate: string } | null>(null);

  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      if (client?.company_name) {
        setCompanyName(client.company_name);
        const parts = client.company_name.trim().split(' ');
        setInitials(parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : client.company_name.slice(0, 2).toUpperCase());
      }

      // Security: scope all job queries to the authenticated client's ID
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, job_title, start_date')
        .eq('client_id', client.id)
        .eq('status', 'completed');

      const jobIds = (jobsData || []).map(j => j.id);

      if (jobIds.length > 0) {
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id, guard_id, guards(id, full_name, profile_photo_url)')
          .in('job_id', jobIds);

        // Security: scope reviews to current user as client (not auth.uid() as client_id)
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*, guards(full_name, profile_photo_url), jobs(job_title, start_date)')
          .eq('client_id', client.id)
          .in('job_id', jobIds)
          .order('created_at', { ascending: false });

        const typedReviews: ReviewItem[] = (reviewsData || []).map((r: any) => ({
          id: r.id,
          job_id: r.job_id,
          guard_id: r.guard_id,
          rating: r.rating,
          review_text: r.review_text,
          review_status: r.review_status || 'reviewed',
          issue_reported: r.issue_reported || false,
          issue_category: r.issue_category,
          punctuality: r.punctuality,
          professionalism: r.professionalism,
          communication: r.communication,
          appearance: r.appearance,
          reliability: r.reliability,
          would_hire_again: r.would_hire_again,
          attendance_status: r.attendance_status,
          site_instructions_followed: r.site_instructions_followed,
          created_at: r.created_at,
          guards: r.guards,
          jobs: r.jobs,
        }));

        setReviews(typedReviews);

        // Calculate pending reviews
        const reviewedGuardJobPairs = new Set((reviewsData || []).map((r: any) => `${r.job_id}-${r.guard_id}`));
        const pending: PendingReview[] = [];
        (assignments || []).forEach((a: any) => {
          const pairKey = `${a.job_id}-${a.guard_id}`;
          if (!reviewedGuardJobPairs.has(pairKey)) {
            const job = jobsData?.find(j => j.id === a.job_id);
            pending.push({
              job_id: a.job_id,
              job_title: job?.job_title || 'Unknown Job',
              start_date: job?.start_date || '',
              guard_id: a.guard_id,
              guard_name: a.guards?.full_name || 'Unknown Guard',
              profile_photo_url: a.guards?.profile_photo_url,
            });
          }
        });
        setPendingReviews(pending);
      } else {
        setReviews([]);
        setPendingReviews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (pending: PendingReview) => {
    setReviewTarget({
      jobId: pending.job_id,
      guardId: pending.guard_id,
      guardName: pending.guard_name,
      jobTitle: pending.job_title,
      startDate: pending.start_date,
    });
    setReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    loadReviews();
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'issue') return r.issue_reported;
    return r.review_status === filterStatus || (filterStatus === 'reviewed' && !r.issue_reported);
  });

  const stats = {
    total: reviews.length,
    pending: pendingReviews.length,
    issues: reviews.filter(r => r.issue_reported).length,
    avgRating: reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0',
  };

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Client" initials="CL" />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          {/* Header Skeleton */}
          <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
            <div className="space-y-1">
              <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#162036] rounded animate-pulse"></div>
              <div className="h-3 w-56 sm:w-64 bg-[#162036] rounded animate-pulse"></div>
            </div>
            <div className="h-8 sm:h-9 w-28 sm:w-32 bg-[#162036] rounded-xl animate-pulse"></div>
          </header>

          <main className="px-4 sm:px-8 py-4 sm:py-8">
            {/* Stats Bar Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4">
                  <div className="h-6 sm:h-8 w-8 sm:w-10 bg-[#162036] rounded animate-pulse mb-1"></div>
                  <div className="h-3 w-20 sm:w-24 bg-[#162036] rounded animate-pulse"></div>
                </div>
              ))}
            </div>

            {/* Tabs Skeleton */}
            <div className="flex gap-1 mb-4 sm:mb-6 bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-1 w-fit shadow-sm">
              <div className="h-9 sm:h-10 w-32 sm:w-40 bg-teal-500/20 rounded-xl animate-pulse"></div>
              <div className="h-9 sm:h-10 w-32 sm:w-40 bg-[#162036] rounded-xl animate-pulse"></div>
            </div>

            {/* Review Card Skeletons */}
            <div className="space-y-3 sm:space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-full flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 sm:w-40 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-3 w-48 sm:w-56 bg-[#162036] rounded animate-pulse"></div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <div className="h-5 w-16 bg-[#162036] rounded-full animate-pulse"></div>
                          <div className="h-5 w-20 bg-[#162036] rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                    <div className="sm:ml-auto flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                      <div className="h-3 w-16 bg-[#162036] rounded animate-pulse"></div>
                      <div className="h-8 w-24 sm:w-28 bg-[#162036] rounded-lg animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar role="client" displayName={companyName} subtitle="Client" initials={initials} />

      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold text-white">Reviews & Ratings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your guard feedback and pending reviews</p>
          </div>
          <Link
            href="/client/jobs"
            className="flex items-center gap-2 px-4 py-2 bg-[#162036] border border-[#1e2d4d] text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Jobs
          </Link>
        </header>

        <main className="px-8 py-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-xs text-slate-500 mt-0.5">Pending Reviews</p>
            </div>
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-emerald-400">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-0.5">Reviews Given</p>
            </div>
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-amber-400">{stats.avgRating}</p>
              <p className="text-xs text-slate-500 mt-0.5">Average Rating</p>
            </div>
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-red-400">{stats.issues}</p>
              <p className="text-xs text-slate-500 mt-0.5">Issues Reported</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-1 w-fit shadow-sm">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'pending' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="ri-time-line"></i>
              Pending ({pendingReviews.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'completed' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="ri-check-double-line"></i>
              Completed ({reviews.length})
            </button>
          </div>

          {/* Pending Reviews */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 bg-[#162036] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : pendingReviews.length === 0 ? (
                <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
                  <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="ri-check-double-line text-3xl text-emerald-500"></i>
                  </div>
                  <h3 className="text-base font-semibold text-slate-300 mb-1">All Caught Up</h3>
                  <p className="text-sm text-slate-500">No pending reviews. Great job keeping your feedback current!</p>
                </div>
              ) : (
                pendingReviews.map((pending) => (
                  <div key={`${pending.job_id}-${pending.guard_id}`} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                      {pending.profile_photo_url ? (
                        <img src={pending.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-teal-400 font-bold text-sm">
                          {pending.guard_name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{pending.guard_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="text-slate-400">{pending.job_title}</span>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span>{new Date(pending.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                        <i className="ri-time-line mr-1"></i>Awaiting Review
                      </span>
                      <button
                        onClick={() => handleOpenReview(pending)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-star-line"></i>
                        Leave Review
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Completed Reviews */}
          {activeTab === 'completed' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {[
                  { key: 'all', label: 'All Reviews', icon: 'ri-filter-3-line' },
                  { key: 'reviewed', label: 'Reviewed', icon: 'ri-check-line' },
                  { key: 'issue', label: 'Issues', icon: 'ri-error-warning-line' },
                  { key: 'disputed', label: 'Disputed', icon: 'ri-alarm-warning-line' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      filterStatus === f.key
                        ? 'bg-teal-500 text-white'
                        : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                    }`}
                  >
                    <i className={f.icon} />
                    {f.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-[#162036] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
                  <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="ri-star-line text-3xl text-slate-600"></i>
                  </div>
                  <h3 className="text-base font-semibold text-slate-300 mb-1">No reviews yet</h3>
                  <p className="text-sm text-slate-500">Completed reviews will appear here once you submit them.</p>
                </div>
              ) : (
                filteredReviews.map((review) => (
                  <div key={review.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                        {review.guards?.profile_photo_url ? (
                          <img src={review.guards.profile_photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-teal-400 font-bold text-sm">
                            {review.guards?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '??'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-white">{review.guards?.full_name || 'Unknown Guard'}</p>
                          <ReviewStatusBadge
                            status={review.review_status || 'reviewed'}
                            rating={review.rating}
                            issueReported={review.issue_reported}
                            compact
                          />
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          <span className="text-slate-400">{review.jobs?.job_title || 'Unknown Job'}</span>
                          <span className="mx-1.5 text-slate-600">·</span>
                          <span>{new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </p>
                        <ReviewStars rating={review.rating} size="sm" />

                        {review.review_text && (
                          <p className="text-sm text-slate-400 mt-3 leading-relaxed">"{review.review_text}"</p>
                        )}

                        {/* Expandable details */}
                        <button
                          onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                          className="mt-2 text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                        >
                          {expandedReview === review.id ? 'Hide Details' : 'View Details'}
                        </button>

                        {expandedReview === review.id && (
                          <div className="mt-3 bg-[#162036] rounded-lg border border-[#1e2d4d] p-3 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                              {review.punctuality && <span>Punctuality: {review.punctuality}/5</span>}
                              {review.professionalism && <span>Professionalism: {review.professionalism}/5</span>}
                              {review.communication && <span>Communication: {review.communication}/5</span>}
                              {review.appearance && <span>Appearance: {review.appearance}/5</span>}
                              {review.reliability && <span>Reliability: {review.reliability}/5</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 pt-2 border-t border-[#1e2d4d]">
                              {review.would_hire_again != null && (
                                <span className={`flex items-center gap-1 ${review.would_hire_again ? 'text-emerald-400' : 'text-red-400'}`}>
                                  <i className={review.would_hire_again ? 'ri-check-line' : 'ri-close-line'} />
                                  Would hire again: {review.would_hire_again ? 'Yes' : 'No'}
                                </span>
                              )}
                              {review.site_instructions_followed != null && (
                                <span className={`flex items-center gap-1 ${review.site_instructions_followed ? 'text-emerald-400' : 'text-red-400'}`}>
                                  <i className={review.site_instructions_followed ? 'ri-check-line' : 'ri-close-line'} />
                                  Site instructions: {review.site_instructions_followed ? 'Followed' : 'Not followed'}
                                </span>
                              )}
                              {review.attendance_status && (
                                <span className={`flex items-center gap-1 ${
                                  review.attendance_status === 'present' ? 'text-emerald-400' :
                                  review.attendance_status === 'late' ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  <i className="ri-user-follow-line" />
                                  Attendance: {review.attendance_status === 'present' ? 'Present' : review.attendance_status === 'late' ? 'Late' : 'No-show'}
                                </span>
                              )}
                            </div>
                            {review.issue_reported && review.issue_category && (
                              <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-2 mt-2">
                                <p className="text-xs text-red-400 font-semibold">Issue: {review.issue_category.replace(/_/g, ' ')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {reviewModalOpen && reviewTarget && (
        <RateGuardModal
          jobId={reviewTarget.jobId}
          guardId={reviewTarget.guardId}
          guardName={reviewTarget.guardName}
          jobTitle={reviewTarget.jobTitle}
          shiftDate={reviewTarget.startDate}
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}