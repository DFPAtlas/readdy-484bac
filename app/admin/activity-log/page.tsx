'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ActivityLog {
  id: string;
  admin_username: string;
  admin_name: string | null;
  action_type: string;
  action_description: string;
  target_type: string | null;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  password_reset: { icon: 'ri-lock-password-line', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  user_created: { icon: 'ri-user-add-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  user_deleted: { icon: 'ri-user-unfollow-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  user_status_changed: { icon: 'ri-user-settings-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  login: { icon: 'ri-login-box-line', color: 'text-teal-400', bg: 'bg-teal-500/10' },
  logout: { icon: 'ri-logout-box-line', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  guard_verified: { icon: 'ri-shield-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  guard_rejected: { icon: 'ri-shield-cross-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  job_deleted: { icon: 'ri-delete-bin-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  maintenance_toggled: { icon: 'ri-tools-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  data_reset: { icon: 'ri-refresh-line', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  storage_usage_query: { icon: 'ri-hard-drive-2-line', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  default: { icon: 'ri-history-line', color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

const PAGE_SIZE = 25;
const EXPORT_BATCH = 100;

function buildFilters(filter: string, search: string) {
  const filters: string[] = [];
  if (filter !== 'all') {
    filters.push(`action_type.eq.${filter}`);
  }
  if (search) {
    const sanitized = search.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
    filters.push(`or(action_description.ilike.*${sanitized}*,admin_username.ilike.*${sanitized}*,admin_name.ilike.*${sanitized}*,target_name.ilike.*${sanitized}*)`);
  }
  return filters;
}

function buildQuery(filter: string, search: string) {
  let query = supabase
    .from('admin_activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  const filters = buildFilters(filter, search);
  for (const f of filters) {
    if (f.startsWith('or(')) {
      query = query.or(f.slice(3, -1));
    } else if (f.startsWith('action_type.eq.')) {
      query = query.eq('action_type', f.slice('action_type.eq.'.length));
    }
  }
  return query;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  const filterChangedRef = useRef(false);

  useEffect(() => {
    setPage(0);
    setLogs([]);
    setError(null);
    setTotalCount(null);
    filterChangedRef.current = true;
  }, [filter, activeSearch]);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      const isReset = filterChangedRef.current;
      filterChangedRef.current = false;
      const currentPage = isReset ? 0 : page;

      if (isReset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const query = buildQuery(filter, activeSearch)
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

        const { data, error: fetchError, count } = await query;

        if (cancelled) return;
        if (fetchError) throw fetchError;

        const results = data || [];
        setTotalCount(count ?? null);
        setHasMore(results.length === PAGE_SIZE);

        if (isReset) {
          setLogs(results);
        } else {
          setLogs(prev => [...prev, ...results]);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || 'Failed to load activity log');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, [filter, activeSearch, page]);

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    setActiveSearch(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const handleRetry = () => {
    setError(null);
    filterChangedRef.current = true;
    setPage(0);
    setLogs([]);
    setTotalCount(null);
  };

  const exportToCSV = async () => {
    setExportProgress({ current: 0, total: 0 });
    try {
      let countQuery = supabase
        .from('admin_activity_log')
        .select('*', { count: 'exact', head: true })
        .order('created_at', { ascending: false });

      const filters = buildFilters(filter, activeSearch);
      for (const f of filters) {
        if (f.startsWith('or(')) {
          countQuery = countQuery.or(f.slice(3, -1));
        } else if (f.startsWith('action_type.eq.')) {
          countQuery = countQuery.eq('action_type', f.slice('action_type.eq.'.length));
        }
      }

      const { count: total, error: countErr } = await countQuery;

      if (countErr) throw countErr;

      const totalRows = total || 0;
      setExportProgress({ current: 0, total: totalRows });

      let allData: ActivityLog[] = [];
      let from = 0;
      let batchHasMore = true;

      while (batchHasMore) {
        const batchQuery = buildQuery(filter, activeSearch)
          .range(from, from + EXPORT_BATCH - 1);

        const { data: batchData, error: batchErr } = await batchQuery;
        if (batchErr) throw batchErr;

        if (!batchData || batchData.length === 0) break;

        allData = [...allData, ...batchData];
        from += EXPORT_BATCH;
        batchHasMore = batchData.length === EXPORT_BATCH;
        setExportProgress({ current: allData.length, total: totalRows });
      }

      const headers = ['Date', 'Time', 'Admin', 'Action Type', 'Description', 'Target'];
      const rows = allData.map(log => {
        const date = new Date(log.created_at);
        return [
          date.toLocaleDateString('en-GB'),
          date.toLocaleTimeString('en-GB'),
          log.admin_name || log.admin_username,
          log.action_type.replace(/_/g, ' '),
          log.action_description.replace(/,/g, ';'),
          log.target_name || '-'
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      setError(err.message || 'Failed to export CSV');
    } finally {
      setExportProgress(null);
    }
  };

  const getConfig = (type: string) => ACTION_CONFIG[type] || ACTION_CONFIG.default;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'login', label: 'Logins' },
    { value: 'password_reset', label: 'Password Resets' },
    { value: 'user_created', label: 'User Created' },
    { value: 'user_deleted', label: 'User Deleted' },
    { value: 'user_status_changed', label: 'Status Changes' },
    { value: 'guard_verified', label: 'Guard Verified' },
    { value: 'guard_rejected', label: 'Guard Rejected' },
    { value: 'job_deleted', label: 'Job Deleted' },
    { value: 'maintenance_toggled', label: 'Maintenance' },
    { value: 'data_reset', label: 'Data Reset' },
    { value: 'storage_usage_query', label: 'Storage Queries' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading activity log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Activity Log</h1>
            <p className="text-sm text-slate-400">Track all admin actions and changes</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-time-line"></i>
              </div>
              <span>
                {logs.length} of {totalCount !== null ? totalCount : '?'} entries
              </span>
            </div>
            {exportProgress ? (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-teal-600/20 border border-teal-500/30 rounded-xl text-sm">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-teal-300 whitespace-nowrap">
                  Exporting {exportProgress.current} of {exportProgress.total}
                </span>
              </div>
            ) : (
              <button
                onClick={exportToCSV}
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-500 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-teal-900/50"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-download-2-line"></i>
                </div>
                Export CSV
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-red-500/20 rounded-full flex-shrink-0">
                <i className="ri-error-warning-line text-red-400 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-300">Failed to load activity log</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
                <i className="ri-refresh-line"></i>
              </div>
              Retry
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-search-line text-slate-500"></i>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search activity..."
              className="w-full pl-11 pr-10 py-2.5 bg-[#111d35] border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500"
            />
            {activeSearch && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-white cursor-pointer"
              >
                <i className="ri-close-circle-fill text-sm"></i>
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-500 transition-colors cursor-pointer whitespace-nowrap shadow-sm shadow-teal-900/50"
          >
            <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
              <i className="ri-search-line"></i>
            </div>
            Search
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {actionTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilter(type.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filter === type.value
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/50'
                    : 'bg-[#111d35] text-slate-400 hover:bg-[#1a2b4a] hover:text-white border border-[#1a2b4a]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden shadow-sm">
          {logs.length === 0 && !error ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-4">
                <i className="ri-history-line text-3xl text-slate-500"></i>
              </div>
              <p className="text-slate-400 font-medium mb-1">No activity found</p>
              <p className="text-sm text-slate-500">
                {activeSearch ? 'Try adjusting your search terms' : 'Actions will appear here as they happen'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a2b4a]">
              {logs.map((log) => {
                const config = getConfig(log.action_type);
                return (
                  <div key={log.id} className="px-6 py-4 hover:bg-[#0f1b30] transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 flex items-center justify-center ${config.bg} rounded-xl flex-shrink-0 mt-0.5`}>
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className={`${config.icon} text-lg ${config.color}`}></i>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-white">{log.action_description}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <div className="w-4 h-4 flex items-center justify-center">
                                  <i className="ri-user-line"></i>
                                </div>
                                {log.admin_name || log.admin_username}
                              </span>
                              {log.target_name && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    <i className="ri-arrow-right-s-line"></i>
                                  </div>
                                  {log.target_name}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                                {log.action_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0" suppressHydrationWarning={true}>
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && logs.length > 0 && (
            <div className="px-6 py-4 border-t border-[#1a2b4a] text-center">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-1">
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading more...
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 text-sm font-medium text-teal-400 hover:bg-teal-500/10 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  Load More
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}