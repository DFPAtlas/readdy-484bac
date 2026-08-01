'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import LeadStatsCards from './LeadStatsCards';
import LeadFilters from './LeadFilters';
import LeadsTable from './LeadsTable';
import LeadDetailDrawer from './LeadDetailDrawer';
import BulkActionsBar from './BulkActionsBar';

const PAGE_SIZE = 25;

interface Lead {
  id: string;
  company_name: string | null;
  sector: string | null;
  website_url: string | null;
  contact_page_url: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  decision_maker_name: string | null;
  source_search: string | null;
  lead_score: number | null;
  reason: string | null;
  status: string | null;
  email_status: string | null;
  opt_out: boolean | null;
  last_scanned_at: string | null;
  created_at: string;
}

export default function LeadFinderClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState('0');
  const [optOutFilter, setOptOutFilter] = useState('all');

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, newThisWeek: 0, highScore: 0, withEmail: 0, optedOut: 0 });

  const loadedRef = useRef(false);
  const loadRef = useRef(load);
  const loadStatsRef = useRef(loadStats);
  loadRef.current = load;
  loadStatsRef.current = loadStats;

  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const buildFilteredQuery = useCallback(() => {
    let query = supabase
      .from('quickguard_leads')
      .select('*', { count: 'exact', head: false })
      .is('deleted_at', null);

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`company_name.ilike.${q},email.ilike.${q},phone.ilike.${q},location.ilike.${q}`);
    }
    if (sectorFilter !== 'all') query = query.eq('sector', sectorFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (emailStatusFilter !== 'all') query = query.eq('email_status', emailStatusFilter);
    if (scoreMin !== '0') query = query.gte('lead_score', parseInt(scoreMin));
    if (optOutFilter === 'true') query = query.eq('opt_out', true);
    if (optOutFilter === 'false') query = query.eq('opt_out', false);

    return query;
  }, [search, sectorFilter, statusFilter, emailStatusFilter, scoreMin, optOutFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = buildFilteredQuery()
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error: err, count } = await query;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setLeads((data || []) as Lead[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [buildFilteredQuery, page]);

  const loadStats = useCallback(async () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const baseQuery = () => supabase.from('quickguard_leads').select('*', { count: 'exact', head: true }).is('deleted_at', null);

    const [totalRes, weekRes, scoreRes, emailRes, optOutRes] = await Promise.all([
      baseQuery(),
      baseQuery().gte('created_at', oneWeekAgo),
      baseQuery().gte('lead_score', 80),
      baseQuery().not('email', 'is', null).neq('email', ''),
      baseQuery().eq('opt_out', true),
    ]);

    setStats({
      total: totalRes.count || 0,
      newThisWeek: weekRes.count || 0,
      highScore: scoreRes.count || 0,
      withEmail: emailRes.count || 0,
      optedOut: optOutRes.count || 0,
    });
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
    loadStats();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    load();
  }, [page, search, sectorFilter, statusFilter, emailStatusFilter, scoreMin, optOutFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sectorFilter, statusFilter, emailStatusFilter, scoreMin, optOutFilter]);

  useEffect(() => {
    const channel = supabase
      .channel('quickguard-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'app', table: 'quickguard_leads' },
        () => {
          loadRef.current();
          loadStatsRef.current();
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.sector) set.add(l.sector); });
    return Array.from(set).sort();
  }, [leads]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(status);
    const { error: err } = await supabase
      .from('quickguard_leads')
      .update({ status })
      .in('id', selectedIds);

    if (err) {
      showToast(`Failed to update leads: ${err.message}`, 'error');
    } else {
      showToast(`${selectedIds.length} lead(s) marked as ${status.replace(/_/g, ' ')}`, 'success');
      setSelectedIds([]);
      load();
    }
    setBulkActionLoading(null);
  };

  const handleBulkExportCSV = () => {
    const selectedLeads = leads.filter(l => selectedIds.includes(l.id));
    if (selectedLeads.length === 0) return;

    const rows = [
      ['ID', 'Company', 'Sector', 'Location', 'Postcode', 'Email', 'Phone', 'Decision Maker', 'Score', 'Status', 'Email Status', 'Opt Out', 'Source Search', 'Reason', 'Last Scanned', 'Created'],
      ...selectedLeads.map(l => [
        l.id,
        l.company_name ?? '',
        l.sector ?? '',
        l.location ?? '',
        l.postcode ?? '',
        l.email ?? '',
        l.phone ?? '',
        l.decision_maker_name ?? '',
        l.lead_score ?? '',
        l.status ?? 'new',
        l.email_status ?? 'not_sent',
        l.opt_out ? 'Yes' : 'No',
        `"${(l.source_search ?? '').replace(/"/g, "'")}"`,
        `"${(l.reason ?? '').replace(/"/g, "'")}"`,
        l.last_scanned_at ?? '',
        l.created_at,
      ]),
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-finder-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const rows = [
      ['ID', 'Company', 'Sector', 'Location', 'Postcode', 'Email', 'Phone', 'Decision Maker', 'Score', 'Status', 'Email Status', 'Opt Out', 'Source Search', 'Last Scanned', 'Created'],
      ...leads.map(l => [
        l.id,
        l.company_name ?? '',
        l.sector ?? '',
        l.location ?? '',
        l.postcode ?? '',
        l.email ?? '',
        l.phone ?? '',
        l.decision_maker_name ?? '',
        l.lead_score ?? '',
        l.status ?? 'new',
        l.email_status ?? 'not_sent',
        l.opt_out ? 'Yes' : 'No',
        `"${(l.source_search ?? '').replace(/"/g, "'")}"`,
        l.last_scanned_at ?? '',
        l.created_at,
      ]),
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-finder-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-900/50">
                <i className="ri-radar-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Lead Finder</h1>
                <p className="text-xs text-slate-400">Leads collected by the n8n internet lead finder agent</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { load(); loadStats(); }}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {realtimeConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {toast && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'
          }`}>
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`} />
            </div>
            {toast.message}
          </div>
        )}

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-error-warning-line text-2xl text-red-400"></i>
            </div>
            <p className="text-sm font-semibold text-red-400">Failed to load leads</p>
            <p className="text-xs text-red-300">{error}</p>
            <button onClick={() => { setError(null); load(); loadStats(); }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-500 transition cursor-pointer whitespace-nowrap">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <LeadStatsCards stats={stats} />
            <LeadFilters search={search} onSearch={setSearch} sectorFilter={sectorFilter} onSector={setSectorFilter} statusFilter={statusFilter} onStatus={setStatusFilter} emailStatusFilter={emailStatusFilter} onEmailStatus={setEmailStatusFilter} scoreMin={scoreMin} onScoreMin={setScoreMin} optOutFilter={optOutFilter} onOptOut={setOptOutFilter} onExport={handleExport} sectors={sectors} />
            <BulkActionsBar selectedCount={selectedIds.length} onMarkContacted={() => handleBulkStatus('contacted')} onMarkNotSuitable={() => handleBulkStatus('not_suitable')} onExportCSV={handleBulkExportCSV} onClear={() => setSelectedIds([])} loading={bulkActionLoading} />
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Showing <span className="font-semibold text-white">{leads.length}</span> of <span className="font-semibold text-white">{totalCount}</span> leads</p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#1a2b4a] rounded-lg text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-arrow-left-s-line"></i></div>
                    Prev
                  </button>
                  <span className="text-xs text-slate-400 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#1a2b4a] rounded-lg text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
                  >
                    Next
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-arrow-right-s-line"></i></div>
                  </button>
                </div>
              )}
            </div>
            <LeadsTable leads={leads} onSelect={setSelected} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onToggleAll={handleToggleAll} />
          </>
        )}
      </div>

      {selected && (
        <LeadDetailDrawer lead={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); load(); loadStats(); }} showToast={showToast} />
      )}
    </div>
  );
}