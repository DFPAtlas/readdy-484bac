import Link from 'next/link';

interface ReviewStatusBadgeProps {
  status: string;
  rating?: number | null;
  issueReported?: boolean;
  compact?: boolean;
}

export default function ReviewStatusBadge({ status, rating, issueReported, compact = false }: ReviewStatusBadgeProps) {
  const configs: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    awaiting_review: {
      label: 'Awaiting Review',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/25',
      icon: 'ri-time-line',
    },
    reviewed: {
      label: 'Reviewed',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/25',
      icon: 'ri-check-double-line',
    },
    issue_reported: {
      label: 'Issue Reported',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/25',
      icon: 'ri-error-warning-line',
    },
    disputed: {
      label: 'Disputed',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/25',
      icon: 'ri-alarm-warning-line',
    },
    hidden: {
      label: 'Internal Review',
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/25',
      icon: 'ri-eye-off-line',
    },
  };

  const config = configs[status] || configs.awaiting_review;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 ${config.bg} ${config.text} border ${config.border} px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap`}>
        <i className={config.icon} />
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} border ${config.border} px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>
      <i className={config.icon} />
      {config.label}
      {rating != null && rating > 0 && (
        <span className="flex items-center gap-0.5 ml-1">
          <span className="text-amber-400">★</span>
          <span>{rating}</span>
        </span>
      )}
      {issueReported && (
        <i className="ri-error-warning-line text-red-400 ml-0.5" />
      )}
    </span>
  );
}

export function ReviewStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`${sizeClass} ${s <= rating ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
      ))}
      <span className="text-xs text-amber-500 font-medium ml-1">({rating}/5)</span>
    </div>
  );
}

export function GuardRatingSummary({
  averageRating,
  totalReviews,
  completedJobs,
}: {
  averageRating?: number | null;
  totalReviews?: number | null;
  completedJobs?: number | null;
}) {
  const rating = averageRating ?? 0;
  const reviews = totalReviews ?? 0;
  const jobs = completedJobs ?? 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {rating > 0 && (
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
          <span className="text-sm font-bold text-amber-400">{rating.toFixed(1)}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={`text-xs ${s <= Math.round(rating) ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
            ))}
          </div>
        </div>
      )}
      {reviews > 0 && (
        <span className="text-xs text-slate-500">{reviews} review{reviews !== 1 ? 's' : ''}</span>
      )}
      {jobs > 0 && (
        <span className="text-xs text-slate-500">{jobs} job{jobs !== 1 ? 's' : ''} completed</span>
      )}
      {rating === 0 && reviews === 0 && (
        <span className="text-xs text-slate-600">No reviews yet</span>
      )}
    </div>
  );
}

export function RecentFeedbackSnippet({ reviews }: { reviews: { review_text?: string; rating: number; created_at: string }[] }) {
  if (!reviews || reviews.length === 0) return null;

  const latest = reviews[0];
  if (!latest.review_text) return null;

  return (
    <div className="bg-[#162036] rounded-lg border border-[#1e2d4d] p-3">
      <div className="flex items-center gap-2 mb-1">
        <ReviewStars rating={latest.rating} size="sm" />
        <span className="text-xs text-slate-500">
          {new Date(latest.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">"{latest.review_text}"</p>
    </div>
  );
}

export function JobReviewBanner({
  jobId,
  jobTitle,
  guardCount,
  reviewedCount,
}: {
  jobId: string;
  jobTitle: string;
  guardCount: number;
  reviewedCount: number;
}) {
  const remaining = guardCount - reviewedCount;
  if (remaining <= 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-5 py-3 flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 rounded-xl shrink-0">
        <i className="ri-star-line text-amber-400 text-xl" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-400">Review your guards</p>
        <p className="text-xs text-amber-400/80">
          {remaining} of {guardCount} guard{guardCount !== 1 ? 's' : ''} from "{jobTitle}" still need{remaining === 1 ? 's' : ''} a review
        </p>
      </div>
      <Link
        href={`/client/jobs/${jobId}`}
        className="shrink-0 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
      >
        Leave Review
      </Link>
    </div>
  );
}