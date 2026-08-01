'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import SubmissionsStatsBar from './SubmissionsStatsBar';
import SubmissionsFilters from './SubmissionsFilters';
import SubmissionsTable from './SubmissionsTable';
import SubmissionDetailModal from './SubmissionDetailModal';

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  category: string | null;
  status: string;
  source: string | null;
  created_at: string;
  user_id?: string | null;
}

const PAGE_SIZE = 20;

export default function AdminSubmissionsClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [stats, setStats] = useState({ new: 0, inProgress: 0, resolved: 0, archived: 0, total: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [hasNewData, setHasNewData] = useState(false);

  const mountedRef = useRef(true);

  const buildFilter = useCallback(() => {
    let q = supabase.from('contact_submissions').select('*', { count: 'exact', head: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,subject.ilike.%${search.trim()}%`);
    }
    return q;
  }, [search, statusFilter, categoryFilter]);

  const buildStatsCount = useCallback((statusVal: string) => {
    let q = supabase.from('contact_submissions').select('*', { count: 'exact', head: true });
    q = q.eq('status', statusVal);
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,subject.ilike.%${search.trim()}%`);
    }
    return q;
  }, [search, categoryFilter]);

  const fetchPage = useCallback(async (pageNum: number, showLoading: boolean) => {
    if (showLoading) setLoading(true);
    setError(null);
    setHasNewData(false);

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [dataRes, newRes, inProgressRes, resolvedRes, archivedRes, catRes] = await Promise.all([
        buildFilter().order('created_at', { ascending: false }).range(from, to),
        buildStatsCount('new'),
        buildStatsCount('in progress'),
        buildStatsCount('resolved'),
        buildStatsCount('archived'),
        supabase.from('contact_submissions').select('category').not('category', 'is', null),
      ]);

      if (!mountedRef.current) return;

      if (dataRes.error && dataRes.error.code !== 'PGRST116') {
        throw new Error(dataRes.error.message || 'Failed to load submissions');
      }

      const rows = (dataRes.data || []) as Submission[];
      const count = dataRes.count ?? 0;

      const nv = newRes.count ?? 0;
      const ipv = inProgressRes.count ?? 0;
      const rv = resolvedRes.count ?? 0;
      const av = archivedRes.count ?? 0;

      setSubmissions(rows);
      setTotalCount(count);
      setPage(pageNum);

      setStats({
        new: nv,
        inProgress: ipv,
        resolved: rv,
        archived: av,
        total: nv + ipv + rv + av,
      });

      if (catRes.data) {
        const allCats = [...new Set((catRes.data as { category: string }[]).map(c => c.category))].sort();
        setCategories(allCats);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
      setSubmissions([]);
      setTotalCount(0);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [buildFilter, buildStatsCount, search]);

  const refresh = useCallback(() => {
    fetchPage(page, true);
  }, [fetchPage, page]);

  const goToPage = useCallback((newPage: number) => {
    fetchPage(newPage, true);
  }, [fetchPage]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPage(0, true);

    const channel = supabase
      .channel('contact-submissions-realtime')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'contact_submissions' }, () => {
        if (mountedRef.current) setHasNewData(true);
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchPage(0, true);
  }, [search, statusFilter, categoryFilter]);

  const handleExport = () => {
    if (totalCount === 0) return;
    const rows = [
      ['ID', 'Date', 'Name', 'Email', 'Phone', 'Category', 'Subject', 'Status', 'Message'],
      ...submissions.map(s => [
        s.id,
        new Date(s.created_at).toLocaleDateString('en-GB'),
        s.name,
        s.email,
        s.phone ?? '',
        s.category ?? '',
        s.subject ?? '',
        s.status,
        `"${s.message.replace(/"/g, "'")}"`,
      ]),
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusFilterChange = (val: string) => { setStatusFilter(val); };
  const handleCategoryFilterChange = (val: string) => { setCategoryFilter(val); };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/50">
                <i className="ri-mail-send-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Contact Submissions</h1>
                <p className="text-xs text-slate-400">Browse and manage contact form entries</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasNewData && (
                <button
                  onClick={refresh}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600/20 border border-teal-500/30 rounded-xl text-sm font-medium text-teal-400 hover:bg-teal-600/30 hover:text-teal-300 cursor-pointer whitespace-nowrap transition-colors"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-refresh-line"></i>
                  </div>
                  New data available
                </button>
              )}
              <button
                onClick={refresh}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full ${hasNewData ? 'bg-amber-500' : 'bg-emerald-500'} ${hasNewData ? '' : 'animate-pulse'}`}></span>
                {hasNewData ? 'Stale' : 'Live'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">Failed to load submissions</p>
                <p className="text-xs text-red-400/70">{error}</p>
              </div>
            </div>
            <button
              onClick={refresh}
              className="px-4 py-2 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 cursor-pointer whitespace-nowrap transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <SubmissionsStatsBar stats={stats} />

        <SubmissionsFilters
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatus={handleStatusFilterChange}
          categoryFilter={categoryFilter}
          onCategory={handleCategoryFilterChange}
          categories={categories}
          onExport={handleExport}
          hasData={totalCount > 0}
        />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? null : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">
                Showing <span className="font-semibold text-white">{submissions.length}</span> of{' '}
                <span className="font-semibold text-white">{totalCount}</span> submissions
                {statusFilter !== 'all' && (
                  <span className="text-slate-500"> — filtered by <span className="text-slate-300 capitalize">{statusFilter}</span></span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#1a2b4a] rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-[#1a2b4a] rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
            <SubmissionsTable submissions={submissions} onSelect={setSelected} />
          </>
        )}
      </div>

      {selected && (
        <SubmissionDetailModal
          submission={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated: Submission) => {
            setSelected(null);
            setSubmissions(prev =>
              prev.map(s => (s.id === updated.id ? updated : s))
            );
            setHasNewData(true);
          }}
        />
      )}
    </div>
  );
}