'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  job_id: string | null;
  jobs?: { job_title: string } | null;
}

interface ReviewsTabProps {
  guardId: string;
  rating: number | null;
  totalReviews: number | null;
}

function StarRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = rating >= star;
        const partial = !filled && rating >= star - 0.5;
        return (
          <span
            key={star}
            className={`${sizeClass} ${filled || partial ? 'text-amber-400' : 'text-slate-700'}`}
          >
            {filled ? '★' : partial ? '⯨' : '★'}
          </span>
        );
      })}
    </div>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-4 text-right">{star}</span>
      <span className="text-amber-400 text-xs">★</span>
      <div className="flex-1 h-2 bg-[#162036] rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
    </div>
  );
}

export default function ReviewsTab({ guardId, rating, totalReviews }: ReviewsTabProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [guardId]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, review_text, created_at, job_id, jobs(job_title)')
      .eq('guard_id', guardId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (!error) setReviews(data || []);
    setLoading(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const starCounts = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => Math.round(r.rating) === s).length,
  }));

  const avgRating = rating ?? 0;
  const total = totalReviews ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="ri-loader-4-line text-4xl text-teal-400 animate-spin"></i>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-[#162036] to-[#111d35] border border-[#1e2d4d] rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold text-white">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            <StarRow rating={avgRating} size="lg" />
            <span className="text-sm text-slate-400 mt-2">
              {total > 0 ? `${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet'}
            </span>
          </div>

          {total > 0 && (
            <div className="flex-1 w-full max-w-xs space-y-2">
              {starCounts.map(({ star, count }) => (
                <RatingBar key={star} star={star} count={count} total={total} />
              ))}
            </div>
          )}
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-full flex items-center justify-center mb-4">
            <i className="ri-star-line text-3xl text-amber-400"></i>
          </div>
          <p className="text-slate-400 font-medium">No reviews yet</p>
          <p className="text-slate-500 text-sm mt-1">Reviews from clients will appear here after completed jobs</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="bg-[#0B1933] border border-[#1e2d4d] rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StarRow rating={review.rating} size="md" />
                    <span className="text-sm font-semibold text-slate-300">{review.rating.toFixed(1)}</span>
                  </div>
                  {review.jobs?.job_title && (
                    <p className="text-xs text-teal-400 font-medium mb-2 flex items-center gap-1">
                      <i className="ri-briefcase-line"></i>
                      {review.jobs.job_title}
                    </p>
                  )}
                  {review.review_text ? (
                    <p className="text-slate-300 text-sm leading-relaxed">{review.review_text}</p>
                  ) : (
                    <p className="text-slate-600 text-sm italic">No written feedback</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-user-line text-slate-600 text-sm"></i>
                    </div>
                    <span className="text-xs text-slate-500">Client</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
