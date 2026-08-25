'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ReviewsStatsBar from './ReviewsStatsBar';
import ReviewsFilters from './ReviewsFilters';
import ReviewsTable from './ReviewsTable';
import ReviewDetailModal from './ReviewDetailModal';
import GuardDetailModal from '../accounts/GuardDetailModal';
import type { Guard } from '../accounts/GuardDetailModal';

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

interface Stats {
  total: number;
  avgRating: number;
  published: number;
  hidden: number;
  fiveStar: number;
}

const PAGE_SIZES = [10, 25, 50];

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, avgRating: 0, published: 0, hidden: 0, fiveStar: 0 });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [guardStats, setGuardStats] = useState<GuardStats | null>(null);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [selectedGuardLoading, setSelectedGuardLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: total },
        { count: published },
        { count: hidden },
        { count: fiveStar },
        { data: publishedRatings },
      ] = await Promise.all([
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'hidden'),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('rating', 5),
        supabase.from('reviews').select('rating').eq('status', 'published'),
      ]);

      const ratings = publishedRatings || [];
      const avg = ratings.length > 0
        ? parseFloat((ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length).toFixed(1))
        : 0;

      setStats({
        total: total || 0,
        avgRating: avg,
        published: published || 0,
        hidden: hidden || 0,
        fiveStar: fiveStar || 0,
      });
    } catch {
      // stats fetch failure is non-critical
    }
  }, []);

  const fetchReviews = useCallback(async (currentPage?: number) => {
    const activePage = currentPage ?? page;
    setLoading(true);
    setError(null);

    try {
      let matchingGuardIds: string[] = [];
      let matchingClientIds: string[] = [];
      let matchingJobIds: string[] = [];

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        const [gRes, cRes, jRes] = await Promise.all([
          supabase.from('guards').select('id').ilike('full_name', `%${q}%`),
          supabase.from('clients').select('id').or(`company_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`),
          supabase.from('jobs').select('id').ilike('job_title', `%${q}%`),
        ]);
        matchingGuardIds = (gRes.data || []).map((g: any) => g.id);
        matchingClientIds = (cRes.data || []).map((c: any) => c.id);
        matchingJobIds = (jRes.data || []).map((j: any) => j.id);
      }

      let query = supabase
        .from('reviews')
        .select('id, rating, review_text, status, created_at, guard_id, job_id, client_id', { count: 'exact' });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }
      if (ratingFilter !== 'All') {
        query = query.eq('rating', parseInt(ratingFilter));
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        const orParts: string[] = [];
        orParts.push(`review_text.ilike.%${q}%`);
        if (matchingGuardIds.length > 0) {
          orParts.push(`guard_id.in.(${matchingGuardIds.join(',')})`);
        }
        if (matchingClientIds.length > 0) {
          orParts.push(`client_id.in.(${matchingClientIds.join(',')})`);
        }
        if (matchingJobIds.length > 0) {
          orParts.push(`job_id.in.(${matchingJobIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }

      const from = (activePage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setTotalCount(count || 0);

      const rows = data || [];
      const guardIds = [...new Set(rows.map((r: any) => r.guard_id).filter(Boolean))];
      const clientIds = [...new Set(rows.map((r: any) => r.client_id).filter(Boolean))];
      const jobIds = [...new Set(rows.map((r: any) => r.job_id).filter(Boolean))];

      const [guardsRes, clientsRes, jobsRes] = await Promise.all([
        guardIds.length > 0
          ? supabase.from('guards').select('id, full_name').in('id', guardIds)
          : Promise.resolve({ data: [] }),
        clientIds.length > 0
          ? supabase.from('clients').select('id, company_name, first_name, last_name').in('id', clientIds)
          : Promise.resolve({ data: [] }),
        jobIds.length > 0
          ? supabase.from('jobs').select('id, job_title').in('id', jobIds)
          : Promise.resolve({ data: [] }),
      ]);

      const guardsMap: Record<string, string> = {};
      (guardsRes.data || []).forEach((g: any) => { guardsMap[g.id] = g.full_name; });

      const clientsMap: Record<string, string> = {};
      (clientsRes.data || []).forEach((c: any) => {
        clientsMap[c.id] = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown Client';
      });

      const jobsMap: Record<string, string> = {};
      (jobsRes.data || []).forEach((j: any) => { jobsMap[j.id] = j.job_title; });

      const enriched: Review[] = rows.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        status: r.status,
        created_at: r.created_at,
        guard_id: r.guard_id,
        guard_name: guardsMap[r.guard_id] || 'Unknown Guard',
        client_name: clientsMap[r.client_id] || 'Unknown Client',
        job_title: jobsMap[r.job_id] || 'Unknown Job',
      }));

      setReviews(enriched);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      setReviews([]);
      setTotalCount(0);
      setLoading(false);
    }
  }, [debouncedSearch, ratingFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, ratingFilter, statusFilter, pageSize]);

  async function handleSelectReview(review: Review) {
    setSelectedReview(review);
    setGuardStats(null);
    if (review.guard_id) {
      const { data } = await supabase
        .from('guards')
        .select('rating, total_reviews')
        .eq('id', review.guard_id)
        .maybeSingle();
      if (data) {
        setGuardStats({
          averageRating: parseFloat((data.rating || 0).toFixed(1)),
          totalReviews: data.total_reviews || 0,
        });
      }
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'published' ? 'hidden' : 'published';
    const { error: updateError } = await supabase.from('reviews').update({ status: newStatus }).eq('id', id);
    if (updateError) {
      showToast('Failed to update review status.', 'error');
      return;
    }
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    if (selectedReview?.id === id) setSelectedReview((prev) => prev ? { ...prev, status: newStatus } : null);
    fetchStats();
    showToast(`Review ${newStatus === 'published' ? 'published' : 'hidden'} successfully.`, 'success');
  }

  async function handleDelete(id: string) {
    const review = reviews.find((r) => r.id === id);
    const { error: deleteError } = await supabase.from('reviews').delete().eq('id', id);
    if (deleteError) {
      showToast('Failed to delete review.', 'error');
      return;
    }

    if (review?.guard_id) {
      const { data: remaining } = await supabase
        .from('reviews')
        .select('rating')
        .eq('guard_id', review.guard_id)
        .eq('status', 'published');

      const count = remaining?.length || 0;
      const avg = count > 0
        ? parseFloat((remaining!.reduce((sum, r) => sum + (r.rating || 0), 0) / count).toFixed(1))
        : 0;

      await supabase.from('guards').update({ rating: avg, total_reviews: count }).eq('id', review.guard_id);
    }

    setSelectedReview(null);
    setGuardStats(null);
    fetchStats();

    const newTotalAfterDelete = totalCount - 1;
    const maxPage = Math.max(1, Math.ceil(newTotalAfterDelete / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
    } else {
      fetchReviews();
    }

    showToast('Review deleted successfully.', 'success');
  }

  async function handleViewGuardProfile(guardId: string) {
    setSelectedGuardLoading(true);
    setSelectedGuard(null);
    const { data } = await supabase
      .from('guards')
      .select('*')
      .eq('id', guardId)
      .maybeSingle();
    if (data) setSelectedGuard(data);
    setSelectedGuardLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  function getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-[#111d35] border-b border-[#1a2b4a] px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Guard Reviews</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage and moderate all client reviews for guards</p>
        </div>
        <button
          onClick={() => { setPage(1); fetchReviews(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 bg-[#111d35] border border-[#1a2b4a] rounded-lg hover:bg-[#1a2b4a] hover:text-white transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
          Refresh
        </button>
      </div>

      <div className="px-8 py-6">
        {loading && reviews.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        ) : error && reviews.length === 0 ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 flex items-center justify-center bg-red-500/10 rounded-full mx-auto mb-4 ring-1 ring-red-500/20">
              <i className="ri-error-warning-line text-2xl text-red-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Reviews</h3>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => { setPage(1); fetchReviews(); fetchStats(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition cursor-pointer text-sm font-medium whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
              Retry
            </button>
          </div>
        ) : (
          <>
            <ReviewsStatsBar
              total={stats.total}
              avgRating={stats.avgRating}
              published={stats.published}
              hidden={stats.hidden}
              fiveStar={stats.fiveStar}
            />

            <ReviewsFilters
              search={search}
              onSearch={setSearch}
              ratingFilter={ratingFilter}
              onRatingFilter={setRatingFilter}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
            />

            {loading && reviews.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                Refreshing...
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {debouncedSearch || ratingFilter !== 'All' || statusFilter !== 'All' ? (
                  <>Showing <span className="font-semibold text-white">{startItem}&ndash;{endItem}</span> of <span className="font-semibold text-white">{totalCount}</span> matching reviews</>
                ) : (
                  <>Showing <span className="font-semibold text-white">{startItem}&ndash;{endItem}</span> of <span className="font-semibold text-white">{totalCount}</span> total reviews</>
                )}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows:</span>
                <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                  {PAGE_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => setPageSize(size)}
                      className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                        pageSize === size
                          ? 'bg-teal-500/20 text-teal-400'
                          : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ReviewsTable
              reviews={reviews}
              onSelect={handleSelectReview}
              onToggleStatus={handleToggleStatus}
              onViewGuardProfile={handleViewGuardProfile}
            />

            {error && reviews.length > 0 && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-red-500/10 rounded-full ring-1 ring-red-500/20">
                    <i className="ri-error-warning-line text-red-400"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-300">Failed to refresh</p>
                    <p className="text-xs text-slate-400">{error}</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchReviews()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                  Retry
                </button>
              </div>
            )}

            {totalCount > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between bg-[#111d35] rounded-xl ring-1 ring-[#1a2b4a] px-4 py-3">
                <p className="text-xs text-slate-500">
                  Page <span className="text-white font-medium">{page}</span> of <span className="text-white font-medium">{totalPages}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition cursor-pointer ${
                      page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                    }`}
                  >
                    <i className="ri-skip-back-mini-line"></i>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition cursor-pointer ${
                      page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                    }`}
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>

                  {getPageNumbers().map((pageNum, idx) =>
                    typeof pageNum === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-500 text-xs">...</span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition cursor-pointer ${
                          page === pageNum
                            ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30'
                            : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition cursor-pointer ${
                      page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                    }`}
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition cursor-pointer ${
                      page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                    }`}
                  >
                    <i className="ri-skip-forward-mini-line"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          guardStats={guardStats}
          onClose={() => { setSelectedReview(null); setGuardStats(null); }}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          onViewGuardProfile={handleViewGuardProfile}
        />
      )}

      {selectedGuard && (
        <GuardDetailModal
          guard={selectedGuard}
          onClose={() => setSelectedGuard(null)}
          onUpdate={() => { fetchReviews(); fetchStats(); }}
        />
      )}

      {selectedGuardLoading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line text-base' : 'ri-error-warning-line text-base'}></i>
          </div>
          {toast.message}
        </div>
      )}
    </div>
  );
}