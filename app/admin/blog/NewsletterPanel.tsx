'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatBlogDate, type NewsletterSubscriber } from '@/lib/blog';

interface NewsletterPanelProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const AUDIENCE_LABEL: Record<string, string> = {
  both: 'Everyone',
  client: 'Clients',
  guard: 'Guards',
};

export default function NewsletterPanel({ onToast }: NewsletterPanelProps) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('id, email, audience, created_at, unsubscribed_at')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (cancelled) return;
      if (error) {
        onToast('Could not load subscribers.', 'error');
        setSubscribers([]);
      } else {
        setSubscribers((data as NewsletterSubscriber[]) || []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return subscribers;
    return subscribers.filter((row) => row.email.toLowerCase().includes(query));
  }, [subscribers, search]);

  const activeCount = subscribers.filter((row) => !row.unsubscribed_at).length;
  const last30 = subscribers.filter((row) => {
    const created = new Date(row.created_at).getTime();
    return Date.now() - created < 30 * 24 * 60 * 60 * 1000;
  }).length;

  function handleExport() {
    if (filtered.length === 0) {
      onToast('There is nothing to export yet.', 'error');
      return;
    }

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['email', 'audience', 'subscribed_at', 'unsubscribed_at'],
      ...filtered.map((row) => [
        row.email,
        row.audience || 'both',
        row.created_at,
        row.unsubscribed_at || '',
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickguard-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast('CSV exported.', 'success');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total subscribers', value: subscribers.length, icon: 'ri-group-line' },
          { label: 'Active', value: activeCount, icon: 'ri-mail-check-line' },
          { label: 'Joined last 30 days', value: last30, icon: 'ri-line-chart-line' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl px-4 py-3.5 flex items-center gap-3">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 flex-shrink-0">
              <i className={`${stat.icon} text-base`} />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white leading-none tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden flex-1 min-w-0">
          <span className="w-9 h-10 flex items-center justify-center flex-shrink-0 text-slate-500">
            <i className="ri-search-line text-sm" />
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email…"
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-600 outline-none py-2.5 pr-3"
          />
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-teal-500 hover:bg-teal-400 rounded-lg transition cursor-pointer whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-download-2-line" /></span>
          Export CSV
        </button>
      </div>

      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-teal-500/10 flex items-center justify-center">
              <i className="ri-mail-send-line text-xl text-teal-400" />
            </div>
            <p className="text-sm font-medium text-white">No subscribers yet</p>
            <p className="text-xs text-slate-500 mt-1">Signups from the public blog will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-[#1a2b4a]">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Interest</th>
                  <th className="px-4 py-3 font-semibold">Subscribed</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[#1a2b4a]/60 last:border-0 hover:bg-[#0B1933]/40">
                    <td className="px-4 py-3 text-white truncate max-w-[260px]">{row.email}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{AUDIENCE_LABEL[row.audience || 'both'] || 'Everyone'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatBlogDate(row.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.unsubscribed_at ? (
                        <span className="text-[11px] font-medium text-slate-400 bg-[#0B1933] border border-[#1a2b4a] px-2 py-0.5 rounded-full">Unsubscribed</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}