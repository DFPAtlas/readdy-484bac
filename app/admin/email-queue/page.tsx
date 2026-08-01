'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface EmailQueueEntry {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  email_type: string;
  status: string;
  created_at: string;
  sent_at: string;
  failed_at: string;
  retry_count: number;
  error_message: string;
  priority: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function EmailQueuePage() {
  const [entries, setEntries] = useState<EmailQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<EmailQueueEntry | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 25;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * perPage, (page + 1) * perPage - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Error fetching email queue:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = entries.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (e.recipient_email && e.recipient_email.toLowerCase().includes(q)) ||
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.recipient_name && e.recipient_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusCounts = () => {
    let pending = 0, sent = 0, failed = 0;
    entries.forEach(e => {
      if (e.status === 'pending') pending++;
      else if (e.status === 'sent') sent++;
      else if (e.status === 'failed') failed++;
    });
    return { pending, sent, failed };
  };

  const counts = getStatusCounts();

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading email queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-mail-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Email Queue</h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {counts.pending} pending · {counts.sent} sent · {counts.failed} failed
                </p>
              </div>
            </div>
            <button
              onClick={fetchEntries}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-base"></i></div>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                <i className="ri-search-line text-slate-500"></i>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email or subject..."
                className="w-full pl-11 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-sm bg-[#0a1628] text-white placeholder-slate-500"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'sent', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(0); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap capitalize ${
                    statusFilter === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-[#0a1628] text-slate-400 hover:text-white hover:bg-[#1a2b4a]'
                  }`}
                >
                  {s}
                  {s !== 'all' && (
                    <span className="ml-1 text-xs opacity-75">
                      ({counts[s as keyof typeof counts] || 0})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Retries</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="border-b border-[#1a2b4a] hover:bg-[#0a1628]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{entry.recipient_email || '\u2014'}</p>
                        {entry.recipient_name && (
                          <p className="text-xs text-slate-500">{entry.recipient_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-300 max-w-xs truncate">{entry.subject || '\u2014'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 font-mono">{entry.email_type || '\u2014'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${statusColors[entry.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(entry.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(entry.sent_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">{entry.retry_count || 0}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="w-16 h-16 flex items-center justify-center bg-[#0a1628] rounded-full mx-auto mb-4">
                        <i className="ri-mail-line text-3xl text-slate-500"></i>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">No emails found</h3>
                      <p className="text-slate-400 text-sm">
                        {statusFilter === 'all'
                          ? 'The email queue is empty.'
                          : `No ${statusFilter} emails found.`}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 border border-[#1a2b4a] text-slate-400 rounded-xl hover:bg-[#1a2b4a] hover:text-white transition-colors text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={entries.length < perPage}
            className="px-4 py-2 border border-[#1a2b4a] text-slate-400 rounded-xl hover:bg-[#1a2b4a] hover:text-white transition-colors text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            Next
          </button>
        </div>

        {selectedEntry && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
            <div className="bg-[#111d35] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-[#1a2b4a]" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-[#1a2b4a] flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-white">Email Details</h3>
                <button onClick={() => setSelectedEntry(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1a2b4a] transition-colors cursor-pointer">
                  <i className="ri-close-line text-2xl text-slate-400"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Recipient</p>
                  <p className="text-sm text-slate-200">{selectedEntry.recipient_email || '\u2014'}</p>
                  {selectedEntry.recipient_name && <p className="text-xs text-slate-500">{selectedEntry.recipient_name}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Subject</p>
                  <p className="text-sm text-slate-200">{selectedEntry.subject || '\u2014'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Type</p>
                    <p className="text-sm text-slate-200 font-mono">{selectedEntry.email_type || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Status</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${statusColors[selectedEntry.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {selectedEntry.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs font-medium text-slate-500 uppercase mb-1">Created</p><p className="text-sm text-slate-200">{formatDate(selectedEntry.created_at)}</p></div>
                  <div><p className="text-xs font-medium text-slate-500 uppercase mb-1">Sent</p><p className="text-sm text-slate-200">{formatDate(selectedEntry.sent_at)}</p></div>
                </div>
                <div><p className="text-xs font-medium text-slate-500 uppercase mb-1">Priority</p><p className="text-sm text-slate-200">{selectedEntry.priority || 0}</p></div>
                <div><p className="text-xs font-medium text-slate-500 uppercase mb-1">Retry Count</p><p className="text-sm text-slate-200">{selectedEntry.retry_count || 0}</p></div>
                {selectedEntry.failed_at && <div><p className="text-xs font-medium text-slate-500 uppercase mb-1">Failed At</p><p className="text-sm text-slate-200">{formatDate(selectedEntry.failed_at)}</p></div>}
                {selectedEntry.error_message && (
                  <div>
                    <p className="text-xs font-medium text-red-400 uppercase mb-1">Error</p>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      <p className="text-sm text-red-300 font-mono whitespace-pre-wrap break-all">{selectedEntry.error_message}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-[#1a2b4a] shrink-0">
                <button onClick={() => setSelectedEntry(null)} className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-500 transition-colors font-semibold whitespace-nowrap shadow-sm shadow-teal-900/50 cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}