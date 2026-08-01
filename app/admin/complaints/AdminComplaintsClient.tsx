'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ComplaintsFilters from './ComplaintsFilters';
import ComplaintsStatsBar from './ComplaintsStatsBar';
import ComplaintsTable from './ComplaintsTable';
import ComplaintDetailModal from './ComplaintDetailModal';

interface Complaint {
  id: string;
  complaint_id: string;
  filed_by_id: string;
  filed_by_type: string;
  filed_against_id: string | null;
  filed_against_type: string | null;
  related_job_id: string | null;
  category: string;
  severity: string;
  description: string;
  evidence_url: string | null;
  status: string;
  admin_notes: string | null;
  client_response: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  filed_by_name?: string;
  filed_against_name?: string;
  job_title?: string;
}

const PAGE_SIZE = 20;

export default function AdminComplaintsClient() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [adminInfo, setAdminInfo] = useState<{ id: string; email: string; name: string } | null>(null);
  const [hasNewData, setHasNewData] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const getAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: admin } = await supabase
        .from('admin_users')
        .select('id, email, full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (admin && mountedRef.current) {
        setAdminInfo({ id: admin.id, email: admin.email, name: admin.full_name });
      }
    };
    getAdmin();
  }, []);

  const buildQuery = useCallback(() => {
    let q = supabase.from('complaints').select('*', { count: 'exact', head: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (severityFilter !== 'all') q = q.eq('severity', severityFilter);
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    if (search.trim()) {
      q = q.or(
        `complaint_id.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
      );
    }
    q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    return q;
  }, [search, statusFilter, severityFilter, categoryFilter, page]);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchErr, count } = await buildQuery();

    if (!mountedRef.current) return;

    if (fetchErr) {
      setError(fetchErr.message || 'Failed to load complaints');
      setLoading(false);
      return;
    }

    const pageData = data ?? [];
    setTotalCount(count ?? 0);

    if (pageData.length === 0) {
      setComplaints([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set([
      ...pageData.map((c: Complaint) => c.filed_by_id),
      ...pageData.map((c: Complaint) => c.filed_against_id).filter(Boolean),
    ])] as string[];

    const jobIds = pageData.map((c: Complaint) => c.related_job_id).filter(Boolean) as string[];

    const [guardsRes, clientsRes, jobsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('guards').select('user_id, full_name').in('user_id', userIds)
        : { data: [] },
      userIds.length > 0
        ? supabase.from('clients').select('user_id, company_name').in('user_id', userIds)
        : { data: [] },
      jobIds.length > 0
        ? supabase.from('jobs').select('id, job_title').in('id', jobIds)
        : { data: [] },
    ]);

    if (!mountedRef.current) return;

    const guards = guardsRes.data ?? [];
    const clients = clientsRes.data ?? [];
    const jobs = jobsRes.data ?? [];

    const enriched: Complaint[] = pageData.map((c: Complaint) => {
      const fbGuard = guards.find((g: any) => g.user_id === c.filed_by_id);
      const fbClient = clients.find((cl: any) => cl.user_id === c.filed_by_id);
      const faGuard = guards.find((g: any) => g.user_id === c.filed_against_id);
      const faClient = clients.find((cl: any) => cl.user_id === c.filed_against_id);
      const job = jobs.find((j: any) => j.id === c.related_job_id);

      return {
        ...c,
        filed_by_name: fbGuard
          ? fbGuard.full_name
          : fbClient?.company_name ?? 'Unknown',
        filed_against_name:
          c.filed_against_type === 'quickguard'
            ? 'QuickGuard Service'
            : faGuard
            ? faGuard.full_name
            : faClient?.company_name ?? 'Unknown',
        job_title: job?.job_title ?? 'N/A',
      };
    });

    setComplaints(enriched);
    setLoading(false);
    setHasNewData(false);
  }, [buildQuery]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, severityFilter, categoryFilter]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    const channel = supabase
      .channel('complaints-realtime')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'complaints' }, () => {
        if (mountedRef.current) {
          setHasNewData(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleExport = () => {
    const rows = [
      ['ID', 'Date', 'Filed By', 'Filed Against', 'Category', 'Severity', 'Status', 'Description'],
      ...complaints.map(c => [
        c.complaint_id,
        new Date(c.created_at).toLocaleDateString('en-GB'),
        c.filed_by_name ?? '',
        c.filed_against_name ?? '',
        c.category,
        c.severity,
        c.status,
        `"${c.description.replace(/"/g, "'")}"`,
      ]),
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaints-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/50">
                <i className="ri-feedback-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Complaints</h1>
                <p className="text-xs text-slate-400">Review and manage all user-submitted complaints</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadComplaints}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
              <span className="flex items-center gap-1.5 text-xs">
                {hasNewData ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-amber-400">Stale</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-400">Live</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <ComplaintsStatsBar
          statusFilter={statusFilter}
          severityFilter={severityFilter}
          categoryFilter={categoryFilter}
          search={search}
        />

        <ComplaintsFilters
          search={search} onSearch={setSearch}
          statusFilter={statusFilter} onStatus={setStatusFilter}
          severityFilter={severityFilter} onSeverity={setSeverityFilter}
          categoryFilter={categoryFilter} onCategory={setCategoryFilter}
          onExport={handleExport}
          hasData={complaints.length > 0}
        />

        {hasNewData && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3">
            <span className="text-sm text-amber-400 font-medium flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-notification-line"></i>
              </div>
              New complaint updates available
            </span>
            <button
              onClick={loadComplaints}
              className="px-4 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/30 cursor-pointer whitespace-nowrap transition-colors"
            >
              Refresh Now
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-xl">
                <i className="ri-error-warning-line text-lg text-red-400"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">Failed to load complaints</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={loadComplaints}
              className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/30 cursor-pointer whitespace-nowrap transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !error ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">
                Page <span className="font-semibold text-white">{page + 1}</span> of{' '}
                <span className="font-semibold text-white">{totalPages}</span>{' '}
                &middot;{' '}
                <span className="font-semibold text-white">{totalCount}</span> complaints total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 border border-[#1a2b4a] rounded-lg text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-[#1a2b4a] rounded-lg text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
            <ComplaintsTable complaints={complaints} onSelect={setSelected} />
          </>
        ) : null}
      </div>

      {selected && (
        <ComplaintDetailModal
          complaint={selected}
          adminInfo={adminInfo}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); loadComplaints(); }}
        />
      )}
    </div>
  );
}