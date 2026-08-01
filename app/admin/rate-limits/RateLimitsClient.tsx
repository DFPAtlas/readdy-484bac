'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RateLimitEvent {
  id: string;
  event_type: string;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  blocked: boolean;
  reason: string | null;
  created_at: string;
}

interface StatsData {
  blockedMagicLinkToday: number;
  blockedRegistrationToday: number;
  totalBlockedToday: number;
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function RateLimitsClient() {
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData>({ blockedMagicLinkToday: 0, blockedRegistrationToday: 0, totalBlockedToday: 0 });
  const [filter, setFilter] = useState<'all' | 'blocked' | 'allowed'>('all');
  const [eventType, setEventType] = useState<'all' | 'magic_link_request' | 'registration'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      let query = supabase
        .from('rate_limit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter === 'blocked') query = query.eq('blocked', true);
      if (filter === 'allowed') query = query.eq('blocked', false);
      if (eventType !== 'all') query = query.eq('event_type', eventType);

      const { data, error: queryErr } = await query;

      if (queryErr) throw queryErr;

      setEvents(data || []);

      const [magicRes, regRes] = await Promise.all([
        supabase.from('rate_limit_events').select('*', { count: 'exact', head: true }).eq('event_type', 'magic_link_request').eq('blocked', true).gte('created_at', todayIso),
        supabase.from('rate_limit_events').select('*', { count: 'exact', head: true }).eq('event_type', 'registration').eq('blocked', true).gte('created_at', todayIso),
      ]);

      setStats({
        blockedMagicLinkToday: magicRes.count ?? 0,
        blockedRegistrationToday: regRes.count ?? 0,
        totalBlockedToday: (magicRes.count ?? 0) + (regRes.count ?? 0),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load rate limit events');
    } finally {
      setLoading(false);
    }
  }, [filter, eventType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <i className="ri-speed-mini-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Rate Limits</h1>
                <p className="text-[11px] text-slate-500">Signup & magic link abuse monitoring</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
                <i className="ri-refresh-line text-base"></i>
              </div>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Failed to load</h3>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
            </div>
            <button onClick={fetchData} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer whitespace-nowrap">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Blocked Today</p>
            <p className="text-3xl font-bold text-white">{stats.totalBlockedToday}</p>
            <p className="text-xs text-slate-500 mt-1">Total blocked attempts</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Magic Link Blocks</p>
            <p className="text-3xl font-bold text-amber-400">{stats.blockedMagicLinkToday}</p>
            <p className="text-xs text-slate-500 mt-1">Today</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Registration Blocks</p>
            <p className="text-3xl font-bold text-red-400">{stats.blockedRegistrationToday}</p>
            <p className="text-xs text-slate-500 mt-1">Today</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-full p-1">
            {(['all', 'blocked', 'allowed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filter === f ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'blocked' ? 'Blocked' : 'Allowed'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-full p-1">
            {(['all', 'magic_link_request', 'registration'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEventType(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  eventType === t ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All Types' : t === 'magic_link_request' ? 'Magic Link' : 'Registration'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-slate-700/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-2xl text-slate-500"></i>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No rate limit events</h3>
            <p className="text-sm text-slate-400">No matching events found for the selected filters.</p>
          </div>
        ) : (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a2b4a]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2b4a]">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#1a2b4a]/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{timeAgo(ev.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          ev.event_type === 'magic_link_request'
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-teal-500/10 text-teal-400'
                        }`}>
                          {ev.event_type === 'magic_link_request' ? 'Magic Link' : 'Registration'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs font-mono max-w-[200px] truncate">{ev.email || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">{ev.ip_address || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ev.blocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Allowed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[250px] truncate">{ev.reason || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-[200px] truncate font-mono">{ev.user_agent ? ev.user_agent.slice(0, 60) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Rate Limit Rules</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0B1933] rounded-xl p-4 border border-[#1a2b4a]">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Magic Link Requests</p>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-400"></span> Max 5 per email per hour</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-400"></span> Max 10 per IP per hour</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-400"></span> 60-second cooldown between requests</li>
              </ul>
            </div>
            <div className="bg-[#0B1933] rounded-xl p-4 border border-[#1a2b4a]">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Registration Attempts</p>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-red-400"></span> Max 3 account creations per email per day</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-red-400"></span> Max 10 registration attempts per IP per day</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}