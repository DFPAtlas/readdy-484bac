'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import LeadDrawer from './LeadDrawer';

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
  enrichment_status: string | null;
  enrichment_notes: string | null;
  page_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_site_name: string | null;
  metadata_text: string | null;
  last_scanned_at: string | null;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function ScorePill({ score }: { score: number | null }) {
  const s = score ?? 0;
  let cls = 'bg-slate-800 text-slate-400';
  if (s >= 80) cls = 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20';
  else if (s >= 60) cls = 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {s}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    contacted: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
    not_suitable: 'bg-slate-800 text-slate-400',
    converted: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
    archived: 'bg-slate-800 text-slate-500',
  };
  const label = (status || 'new').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status ?? 'new'] ?? map.new}`}>
      {label}
    </span>
  );
}

function EmailStatusBadge({ status }: { status: string | null }) {
  const s = status || 'not_sent';
  let cls = 'bg-slate-800 text-slate-500';
  if (s === 'sent') cls = 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20';
  else if (s === 'replied') cls = 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20';
  else if (s === 'bounced') cls = 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20';
  else if (s === 'queued') cls = 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20';
  else if (s === 'unsubscribed') cls = 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${cls}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export default function LeadsClient() {
  const [all, setAll] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState('0');
  const [hideOptedOut, setHideOptedOut] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('quickguard_leads')
      .select('*')
      .order('lead_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setAll((data || []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    all.forEach(l => { if (l.sector) set.add(l.sector); });
    return Array.from(set).sort();
  }, [all]);

  useEffect(() => {
    let result = [...all];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.company_name ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      );
    }

    if (sectorFilter !== 'all') result = result.filter(l => l.sector === sectorFilter);
    if (statusFilter !== 'all') result = result.filter(l => (l.status || 'new') === statusFilter);
    if (scoreMin !== '0') result = result.filter(l => (l.lead_score ?? 0) >= parseInt(scoreMin));
    if (hideOptedOut) result = result.filter(l => !l.opt_out);

    setFiltered(result);
  }, [all, search, sectorFilter, statusFilter, scoreMin, hideOptedOut]);

  const stats = useMemo(() => {
    const total = all.length;
    const newCount = all.filter(l => (l.status || 'new') === 'new').length;
    const contactedCount = all.filter(l => l.status === 'contacted').length;
    const scores = all.map(l => l.lead_score ?? 0).filter(s => s > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { total, newCount, contactedCount, avgScore };
  }, [all]);

  const handleUpdate = (updatedLead: Lead) => {
    setAll(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelected(updatedLead);
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#0B1933]/90 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center ring-1 ring-teal-500/20">
                <i className="ri-user-search-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Leads</h1>
                <p className="text-xs text-slate-400">Manage leads collected by the internet lead finder</p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#111d35] hover:text-white transition cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line"></i>
              </div>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="px-5 sm:px-8 py-8 space-y-6">
        {error ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-error-warning-line text-2xl text-red-400"></i>
            </div>
            <p className="text-sm font-semibold text-red-400">Failed to load leads</p>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition cursor-pointer whitespace-nowrap border border-red-500/20"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 animate-pulse">
                  <div className="h-3 w-16 bg-[#1a2b4a] rounded mb-3"></div>
                  <div className="h-7 w-12 bg-[#1a2b4a] rounded"></div>
                </div>
              ))}
            </div>
            <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 animate-pulse">
              <div className="h-4 w-full bg-[#1a2b4a] rounded"></div>
            </div>
            <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 w-full bg-[#1a2b4a] rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Leads</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">New</p>
                <p className="text-2xl font-bold text-blue-400">{stats.newCount}</p>
              </div>
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contacted</p>
                <p className="text-2xl font-bold text-amber-400">{stats.contactedCount}</p>
              </div>
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Avg Score</p>
                <p className="text-2xl font-bold text-teal-400">{stats.avgScore}</p>
              </div>
            </div>

            <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="ri-search-line text-slate-500 text-sm"></i>
                  </div>
                  <input
                    type="text"
                    placeholder="Search company or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0B1933] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <select
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                  className="px-3 py-2.5 bg-[#0B1933] border border-[#1a2b4a] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50 pr-8 cursor-pointer"
                >
                  <option value="all">All Sectors</option>
                  {sectors.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 bg-[#0B1933] border border-[#1a2b4a] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50 pr-8 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                </select>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 whitespace-nowrap">Min score</label>
                  <input
                    type="number"
                    value={scoreMin}
                    onChange={e => setScoreMin(e.target.value)}
                    min="0"
                    max="100"
                    className="w-16 px-2 py-2.5 bg-[#0B1933] border border-[#1a2b4a] rounded-xl text-sm text-white text-center focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <button
                  onClick={() => setHideOptedOut(!hideOptedOut)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                    hideOptedOut
                      ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      : 'bg-[#0B1933] text-slate-400 border-[#1a2b4a] hover:text-white'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={hideOptedOut ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </div>
                  {hideOptedOut ? 'Hiding opted-out' : 'Show opted-out'}
                </button>

                {search || sectorFilter !== 'all' || statusFilter !== 'all' || scoreMin !== '0' ? (
                  <button
                    onClick={() => { setSearch(''); setSectorFilter('all'); setStatusFilter('all'); setScoreMin('0'); }}
                    className="px-3 py-2.5 text-sm text-slate-400 hover:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl py-20 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#0B1933] rounded-2xl flex items-center justify-center mb-4">
                  <i className="ri-user-search-line text-3xl text-slate-600"></i>
                </div>
                <p className="text-lg font-semibold text-white">No leads yet — run the lead finder</p>
                <p className="text-sm text-slate-500 mt-1">Leads will appear here once the n8n agent collects them</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  Showing <span className="font-semibold text-white">{filtered.length}</span> of{' '}
                  <span className="font-semibold text-white">{all.length}</span> leads
                </p>

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0B1933] border-b border-[#1a2b4a]">
                        <tr>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Company</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sector</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Score</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Email</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Phone</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Email Status</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {filtered.map(l => (
                          <tr
                            key={l.id}
                            onClick={() => setSelected(l)}
                            className="hover:bg-[#0B1933] transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-4">
                              <div>
                                {l.website_url ? (
                                  <a
                                    href={l.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="font-semibold text-white hover:text-teal-400 transition text-sm whitespace-nowrap"
                                  >
                                    {l.company_name || '—'}
                                    <i className="ri-external-link-line text-[10px] ml-1 align-top"></i>
                                  </a>
                                ) : (
                                  <p className="font-semibold text-white text-sm whitespace-nowrap">{l.company_name || '—'}</p>
                                )}
                                {l.opt_out && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 mt-0.5">
                                    <i className="ri-forbid-2-line text-[10px]"></i>
                                    Opted Out
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">{l.sector || '—'}</td>
                            <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap max-w-[160px] truncate">{l.location || '—'}</td>
                            <td className="px-5 py-4"><ScorePill score={l.lead_score} /></td>
                            <td className="px-5 py-4 text-slate-400 text-sm max-w-[180px] truncate">{l.email || '—'}</td>
                            <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">{l.phone || '—'}</td>
                            <td className="px-5 py-4"><StatusBadge status={l.status} /></td>
                            <td className="px-5 py-4"><EmailStatusBadge status={l.email_status} /></td>
                            <td className="px-5 py-4 text-slate-500 text-sm whitespace-nowrap">
                              {timeAgo(l.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}