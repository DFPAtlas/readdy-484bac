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

interface Props {
  reviews: Review[];
  onSelect: (review: Review) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onViewGuardProfile: (guardId: string) => void;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="w-4 h-4 flex items-center justify-center">
          <i className={`${s <= rating ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-slate-600'} text-sm`}></i>
        </div>
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-300">{rating}/5</span>
    </div>
  );
}

export default function ReviewsTable({ reviews, onSelect, onToggleStatus, onViewGuardProfile }: Props) {
  if (reviews.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-xl ring-1 ring-[#1a2b4a] p-16 text-center">
        <div className="w-14 h-14 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-4">
          <i className="ri-star-line text-2xl text-slate-500"></i>
        </div>
        <p className="text-slate-300 font-medium">No reviews found</p>
        <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-xl ring-1 ring-[#1a2b4a] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Guard</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Job</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rating</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Feedback</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a2b4a]">
          {reviews.map((review) => (
            <tr key={review.id} className="hover:bg-[#0a1628]/50 transition">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center bg-teal-500/10 rounded-full flex-shrink-0 ring-1 ring-teal-500/20">
                    <i className="ri-shield-user-line text-sm text-teal-400"></i>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-200 whitespace-nowrap">{review.guard_name || '—'}</span>
                    {review.guard_id && (
                      <button
                        onClick={() => onViewGuardProfile(review.guard_id)}
                        className="text-xs text-teal-400 hover:text-teal-300 hover:underline whitespace-nowrap cursor-pointer text-left"
                      >
                        View profile →
                      </button>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-300 whitespace-nowrap">{review.client_name || '—'}</td>
              <td className="px-5 py-4">
                <span className="text-slate-300 max-w-[160px] truncate block">{review.job_title || '—'}</span>
              </td>
              <td className="px-5 py-4">
                <Stars rating={review.rating} />
              </td>
              <td className="px-5 py-4">
                {review.review_text ? (
                  <span className="text-slate-300 max-w-[200px] truncate block">{review.review_text}</span>
                ) : (
                  <span className="text-slate-500 italic text-xs">No feedback</span>
                )}
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  review.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                }`}>
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className={review.status === 'published' ? 'ri-eye-line' : 'ri-eye-off-line'}></i>
                  </div>
                  {review.status === 'published' ? 'Published' : 'Hidden'}
                </span>
              </td>
              <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-xs">
                {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelect(review)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer"
                    title="View details"
                  >
                    <i className="ri-eye-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => onToggleStatus(review.id, review.status)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition cursor-pointer ${
                      review.status === 'published'
                        ? 'hover:bg-red-500/10 text-slate-400 hover:text-red-400'
                        : 'hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400'
                    }`}
                    title={review.status === 'published' ? 'Hide review' : 'Publish review'}
                  >
                    <i className={review.status === 'published' ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                  </button>
                  {review.guard_id && (
                    <button
                      onClick={() => onViewGuardProfile(review.guard_id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 transition cursor-pointer"
                      title="View guard profile"
                    >
                      <i className="ri-shield-user-line text-sm"></i>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}