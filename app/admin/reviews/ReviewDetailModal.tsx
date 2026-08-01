'use client';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  status: string;
  created_at: string;
  guard_name: string;
  client_name: string;
  job_title: string;
  guard_id: string;
}

interface GuardStats {
  averageRating: number;
  totalReviews: number;
}

interface Props {
  review: Review | null;
  guardStats: GuardStats | null;
  onClose: () => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
  onViewGuardProfile: (guardId: string) => void;
}

function StarRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="w-5 h-5 flex items-center justify-center">
          <i className={`${s <= Math.round(rating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-slate-600'} ${sz}`}></i>
        </div>
      ))}
    </div>
  );
}

export default function ReviewDetailModal({ review, guardStats, onClose, onToggleStatus, onDelete, onViewGuardProfile }: Props) {
  if (!review) return null;

  const isPublished = review.status === 'published';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a1628] rounded-2xl shadow-xl w-full max-w-lg border border-[#1a2b4a]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
          <h2 className="text-lg font-semibold text-white">Review Details</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] cursor-pointer">
            <i className="ri-close-line text-lg text-slate-400"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {guardStats !== null && (
            <div className="flex items-center gap-4 bg-teal-500/10 border border-teal-500/20 rounded-xl px-4 py-3">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-full shrink-0 ring-1 ring-teal-500/20">
                <i className="ri-shield-star-line text-teal-400 text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-teal-300 font-medium mb-0.5">Guard's Overall Rating</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRow rating={guardStats.averageRating} size="sm" />
                  <span className="text-sm font-bold text-teal-300">
                    {guardStats.averageRating > 0 ? guardStats.averageRating.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs text-teal-400/60">
                    ({guardStats.totalReviews} {guardStats.totalReviews === 1 ? 'review' : 'reviews'} total)
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-teal-400/60">This review</p>
                <p className="text-lg font-bold text-teal-300">{review.rating}<span className="text-xs font-normal text-teal-400/60">/5</span></p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <StarRow rating={review.rating} />
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isPublished ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'}`}>
              {isPublished ? 'Published' : 'Hidden'}
            </span>
          </div>

          <div className="bg-[#111d35] rounded-xl p-4 ring-1 ring-[#1a2b4a]">
            <p className="text-sm text-slate-300 leading-relaxed">
              {review.review_text || <span className="italic text-slate-500">No written feedback provided.</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Guard</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-200">{review.guard_name || '—'}</p>
                {review.guard_id && (
                  <button
                    onClick={() => onViewGuardProfile(review.guard_id)}
                    className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 hover:underline cursor-pointer whitespace-nowrap"
                    title="View guard account"
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-external-link-line"></i>
                    </div>
                    View profile
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Client</p>
              <p className="text-sm font-medium text-slate-200">{review.client_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Job</p>
              <p className="text-sm font-medium text-slate-200">{review.job_title || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Submitted</p>
              <p className="text-sm font-medium text-slate-200">
                {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {review.guard_id && (
            <button
              onClick={() => onViewGuardProfile(review.guard_id)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 rounded-xl transition cursor-pointer whitespace-nowrap ring-1 ring-teal-500/20"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-shield-user-line"></i>
              </div>
              View Guard's Full Account
              <div className="w-4 h-4 flex items-center justify-center ml-auto">
                <i className="ri-arrow-right-line"></i>
              </div>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a2b4a] gap-3">
          <button
            onClick={() => onDelete(review.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
            Delete Review
          </button>
          <button
            onClick={() => onToggleStatus(review.id, review.status)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              isPublished
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={isPublished ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
            </div>
            {isPublished ? 'Hide Review' : 'Publish Review'}
          </button>
        </div>
      </div>
    </div>
  );
}