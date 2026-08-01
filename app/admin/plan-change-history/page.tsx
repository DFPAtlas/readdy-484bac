'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import PlanChangeDetailModal from './PlanChangeDetailModal';

interface PlanChangeRecord {
  id: number;
  user_id: string;
  old_plan_slug: string | null;
  new_plan_slug: string;
  old_plan_name: string | null;
  new_plan_name: string;
  account_type: string;
  changed_by: string;
  change_source: string;
  proration_applied: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  metadata: any;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

const PAGE_SIZE = 25;

export default function PlanChangeHistoryPage() {
  const [records, setRecords] = useState<PlanChangeRecord[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<PlanChangeRecord | null>(null);

  const userIdsRef = useRef<Set<string>>(new Set());

  const fetchUsers = async (ids: string[]) => {
    if (ids.length === 0) return;
    const newIds = ids.filter(id => !userIdsRef.current.has(id));
    if (newIds.length === 0) return;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, user_type')
      .in('id', newIds);

    if (userError) {
      console.error('Failed to load user data:', userError);
      return;
    }

    const map: Record<string, UserInfo> = {};
    (userData || []).forEach((u: any) => {
      map[u.id] = u;
    });
    newIds.forEach(id => userIdsRef.current.add(id));
    setUsers(prev => ({ ...prev, ...map }));
  };

  const fetchData = useCallback(async (pageNum: number, silent?: boolean) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const { count, error: countError } = await supabase
        .from('plan_change_history')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: recordData, error: dataError } = await supabase
        .from('plan_change_history')
        .select('*')
        .order('created_at', { ascending: sortDir === 'asc' })
        .range(from, to);

      if (dataError) throw dataError;

      const recs = (recordData || []) as PlanChangeRecord[];
      setRecords(recs);

      const ids = [...new Set(recs.map(r => r.user_id).filter(Boolean))];
      await fetchUsers(ids);

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to load plan change history:', err);
      setError(err?.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [sortDir]);

  useEffect(() => {
    fetchData(page);
  }, [page, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [sortDir]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-plan-change-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'plan_change_history' }, (payload) => {
        setUpdating(true);
        const newRecord = payload.new as PlanChangeRecord;
        setTotalCount(prev => prev + 1);
        setLastUpdated(new Date());

        const newUserId = newRecord.user_id;
        if (newUserId && !userIdsRef.current.has(newUserId)) {
          fetchUsers([newUserId]);
        }

        setRecords(prev => {
          const exists = prev.some(r => r.id === newRecord.id);
          if (exists) return prev;
          const updated = [newRecord, ...prev];
          if (sortDir === 'desc') {
            updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          } else {
            updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          }
          return updated.slice(0, PAGE_SIZE);
        });

        setTimeout(() => setUpdating(false), 800);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sortDir]);

  const filtered = useMemo(() => {
    let list = [...records];

    if (typeFilter !== 'all') {
      list = list.filter(r => r.account_type === typeFilter);
    }

    if (sourceFilter !== 'all') {
      list = list.filter(r => r.change_source === sourceFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => {
        const u = users[r.user_id];
        return (
          u?.email?.toLowerCase().includes(q) ||
          u?.full_name?.toLowerCase().includes(q) ||
          r.new_plan_name?.toLowerCase().includes(q) ||
          r.old_plan_name?.toLowerCase().includes(q) ||
          r.stripe_subscription_id?.toLowerCase().includes(q) ||
          r.changed_by?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [records, users, typeFilter, sourceFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = totalCount;
    const switches = records.filter(r => {
      if (!r.old_plan_slug) return false;
      return r.old_plan_slug !== r.new_plan_slug;
    }).length;
    const prorated = records.filter(r => r.proration_applied).length;
    const today = new Date();
    const last30 = records.filter(r => {
      const d = new Date(r.created_at);
      return (today.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, switches, prorated, last30 };
  }, [records, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sourceBadge = (source: string) => {
    switch (source) {
      case 'checkout': return 'bg-blue-500/15 text-blue-400 border-blue-400/20';
      case 'webhook': return 'bg-purple-500/15 text-purple-400 border-purple-400/20';
      case 'admin': return 'bg-amber-500/15 text-amber-400 border-amber-400/20';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-400/20';
    }
  };

  const directionBadge = (oldPlan: string | null, newPlan: string) => {
    if (!oldPlan) {
      return { label: 'New', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/20', icon: 'ri-add-circle-line' };
    }
    const oldIsGuard = oldPlan.startsWith('guard');
    const newIsGuard = newPlan.startsWith('guard');
    if (oldIsGuard !== newIsGuard) {
      return { label: 'Switch', color: 'bg-sky-500/15 text-sky-400 border-sky-400/20', icon: 'ri-swap-line' };
    }
    return { label: 'Change', color: 'bg-amber-500/15 text-amber-400 border-amber-400/20', icon: 'ri-arrow-right-circle-line' };
  };

  const exportCSV = () => {
    const headers = ['User Name', 'User Email', 'Type', 'Old Plan', 'New Plan', 'Direction', 'Source', 'Changed By', 'Prorated', 'Stripe Subscription ID', 'Date', 'Metadata'];
    const rows = filtered.map(r => {
      const u = users[r.user_id];
      const dir = directionBadge(r.old_plan_slug, r.new_plan_slug);
      const metaStr = r.metadata ? JSON.stringify(r.metadata) : '';
      return [
        u?.full_name || u?.email || '',
        u?.email || '',
        r.account_type,
        r.old_plan_name || '',
        r.new_plan_name,
        dir.label,
        r.change_source,
        r.changed_by || 'System',
        r.proration_applied ? 'Yes' : 'No',
        r.stripe_subscription_id || '',
        formatDate(r.created_at),
        metaStr,
      ];
    });

    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `plan-change-history-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1e2d4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-500/20">
                <i className="ri-history-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Plan Change History</h1>
                <p className="text-xs text-slate-400">
                  {updating ? 'Updating...' : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {updating && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium border border-teal-400/20">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                  Live
                </span>
              )}
              <button
                onClick={exportCSV}
                disabled={filtered.length === 0}
                className={`flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filtered.length === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-download-2-line"></i>
                </div>
                Export CSV
              </button>
              <button
                onClick={() => fetchData(page)}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                <i className="ri-error-warning-line text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">Failed to load plan change history</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchData(page)}
              className="px-4 py-2 bg-red-500/20 border border-red-400/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Changes', value: stats.total, icon: 'ri-history-line', color: 'bg-purple-500/15 text-purple-400' },
            { label: 'Plan Switches', value: stats.switches, icon: 'ri-swap-line', color: 'bg-sky-500/15 text-sky-400' },
            { label: 'Prorated', value: stats.prorated, icon: 'ri-percent-line', color: 'bg-emerald-500/15 text-emerald-400' },
            { label: 'Last 30 Days', value: stats.last30, icon: 'ri-calendar-line', color: 'bg-amber-500/15 text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                  <i className={`${s.icon} text-base`}></i>
                </div>
                <span className="text-xs font-medium text-slate-400">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="relative w-full lg:w-80">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500">
              <i className="ri-search-line"></i>
            </div>
            <input
              type="text"
              placeholder="Search by email, name, plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 py-2.5 border border-[#1e2d4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-transparent w-full bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 bg-[#0a1628] focus:ring-2 focus:ring-teal-500/50 focus:border-transparent cursor-pointer pr-8"
            >
              <option value="all">All Types</option>
              <option value="client">Clients</option>
              <option value="guard">Guards</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 bg-[#0a1628] focus:ring-2 focus:ring-teal-500/50 focus:border-transparent cursor-pointer pr-8"
            >
              <option value="all">All Sources</option>
              <option value="checkout">Checkout (user-initiated)</option>
              <option value="webhook">Webhook (Stripe event)</option>
              <option value="admin">Admin</option>
            </select>

            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={sortDir === 'asc' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
              </div>
              {sortDir === 'asc' ? 'Oldest first' : 'Newest first'}
            </button>

            <button
              onClick={() => {
                setTypeFilter('all');
                setSourceFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-300">{filtered.length}</span> on page{' '}
            <span className="font-semibold text-slate-300">{page}</span> of{' '}
            <span className="font-semibold text-slate-300">{totalPages}</span>
            {' '}· Total records: <span className="font-semibold text-slate-300">{totalCount}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page <= 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-left-s-line"></i>
              </div>
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Next
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line"></i>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 bg-slate-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-history-line text-2xl text-slate-500"></i>
              </div>
              <p className="text-slate-400 text-sm">No plan change records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2d4a] bg-[#0d1a30]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Change</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Changed By</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Prorated</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d4a]">
                  {filtered.map((r) => {
                    const u = users[r.user_id];
                    const dir = directionBadge(r.old_plan_slug, r.new_plan_slug);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">{u?.full_name || u?.email || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{u?.email || r.user_id.slice(0, 12) + '...'}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            r.account_type === 'client' ? 'bg-teal-500/10 text-teal-400 border-teal-400/20' : 'bg-blue-500/10 text-blue-400 border-blue-400/20'
                          }`}>
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className={r.account_type === 'client' ? 'ri-building-line' : 'ri-shield-user-line'}></i>
                            </div>
                            {r.account_type === 'client' ? 'Client' : 'Guard'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${dir.color}`}>
                              <div className="w-3.5 h-3.5 flex items-center justify-center">
                                <i className={dir.icon}></i>
                              </div>
                              {dir.label}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs">
                              {r.old_plan_name ? (
                                <>
                                  <span className="text-slate-500">{r.old_plan_name}</span>
                                  <span className="text-slate-600">→</span>
                                </>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                              <span className="text-white font-medium">{r.new_plan_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${sourceBadge(r.change_source)}`}>
                            {r.change_source === 'checkout' ? 'Checkout' : r.change_source === 'webhook' ? 'Webhook' : r.change_source}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-slate-400">{r.changed_by || 'System'}</span>
                        </td>
                        <td className="px-5 py-4">
                          {r.proration_applied ? (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <i className="ri-checkbox-circle-fill text-xs"></i>
                              </div>
                              <span className="text-xs font-medium">Yes</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <i className="ri-indeterminate-circle-line text-xs"></i>
                              </div>
                              <span className="text-xs">No</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs text-slate-400 whitespace-nowrap">{formatDate(r.created_at)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelectedRecord(r)}
                            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                          >
                            <i className="ri-information-line"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page <= 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-left-s-line"></i>
              </div>
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Next
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line"></i>
              </div>
            </button>
          </div>
        </div>
      </main>

      {selectedRecord && (
        <PlanChangeDetailModal
          record={selectedRecord}
          user={users[selectedRecord.user_id]}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}