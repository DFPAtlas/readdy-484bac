'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import EmailStatsCards from './EmailStatsCards';
import EmailFilters, { DateRange } from './EmailFilters';
import ErrorDetailModal from './ErrorDetailModal';

interface EmailLogEntry {
  id: string;
  function_name: string;
  template: string | null;
  recipient: string;
  status: string;
  error_message: string | null;
  related_user_id: string | null;
  related_job_id: string | null;
  sent_at: string | null;
  created_at: string;
}

interface TemplateStat {
  template: string;
  total: number;
  sent: number;
  failed: number;
  last_sent: string;
}

const PAGE_SIZE = 25;

function getDateRange(range: DateRange, customStart: string, customEnd: string): { since: string; until: string } {
  const now = new Date();
  let since: Date;
  switch (range) {
    case '24h':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '30d':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      since = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }
  let until: Date;
  if (range === 'custom' && customEnd) {
    until = new Date(customEnd);
    until.setHours(23, 59, 59, 999);
  } else {
    until = now;
  }
  return { since: since.toISOString(), until: until.toISOString() };
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskEmail(email: string) {
  const atIdx = email.indexOf('@');
  if (atIdx <= 2) return email;
  return email.slice(0, 2) + '\u2022\u2022\u2022' + email.slice(atIdx);
}

export default function EmailHealthClient() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [templateStats, setTemplateStats] = useState<TemplateStat[]>([]);
  const [allTemplates, setAllTemplates] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState<EmailLogEntry | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');

  const hasFilters = statusFilter !== '' || templateFilter !== '' || dateRange !== '7d';

  const buildQuery = useCallback((select: string, options?: { count?: 'exact'; head?: boolean }) => {
    const { since, until } = getDateRange(dateRange, customStart, customEnd);
    let query = supabase
      .from('email_send_log')
      .select(select, options || {})
      .gte('created_at', since)
      .lte('created_at', until);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (templateFilter) query = query.eq('template', templateFilter);
    return query;
  }, [dateRange, customStart, customEnd, statusFilter, templateFilter]);

  const fetchData = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const { since, until } = getDateRange(dateRange, customStart, customEnd);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from('email_send_log')
        .select('*')
        .gte('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter) dataQuery = dataQuery.eq('status', statusFilter);
      if (templateFilter) dataQuery = dataQuery.eq('template', templateFilter);

      const { data, error: fetchError } = await dataQuery;

      if (fetchError) throw new Error(fetchError.message);

      const allData = (data || []) as EmailLogEntry[];
      setLogs(allData);

      const { count } = await buildQuery('*', { count: 'exact', head: true });
      setTotalCount(count ?? 0);

      const { count: sentCount } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .lte('created_at', until)
        .eq('status', 'sent');
      setTotalSent(sentCount ?? 0);

      const { count: failedCount } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .lte('created_at', until)
        .eq('status', 'failed');
      setTotalFailed(failedCount ?? 0);

      const { data: distinctTemplates } = await supabase
        .from('email_send_log')
        .select('template')
        .gte('created_at', since)
        .lte('created_at', until)
        .not('template', 'is', null)
        .order('template');

      const uniqueTemplates = [...new Set((distinctTemplates || []).map((r: any) => r.template))] as string[];
      setAllTemplates(uniqueTemplates);

      const templateMap: Record<string, TemplateStat> = {};
      allData.forEach((l) => {
        const key = l.template || 'unknown';
        if (!templateMap[key]) {
          templateMap[key] = { template: key, total: 0, sent: 0, failed: 0, last_sent: l.created_at };
        }
        templateMap[key].total++;
        if (l.status === 'sent') templateMap[key].sent++;
        if (l.status === 'failed') templateMap[key].failed++;
        if (l.created_at > templateMap[key].last_sent) templateMap[key].last_sent = l.created_at;
      });
      setTemplateStats(Object.values(templateMap).sort((a, b) => b.total - a.total));
    } catch (err: any) {
      setError(err?.message || 'Failed to load email logs');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, dateRange, customStart, customEnd, statusFilter, templateFilter]);

  useEffect(() => {
    setCurrentPage(1);
    fetchData(1);
  }, [fetchData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(page);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(currentPage);
    setRefreshing(false);
  };

  const clearFilters = () => {
    setDateRange('7d');
    setCustomStart('');
    setCustomEnd('');
    setStatusFilter('');
    setTemplateFilter('');
  };

  const handleCsvExport = () => {
    if (logs.length === 0) return;
    const headers = ['Time', 'Function', 'Template', 'Recipient', 'Status', 'Error'];
    const rows = logs.map((l) => [
      l.sent_at || l.created_at,
      l.function_name,
      l.template || '',
      l.recipient,
      l.status,
      (l.error_message || '').replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-health-export-${new Date().toISOString().slice(0, 10)}.csv`;
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
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-mail-check-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Email Health</h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {dateRange === '24h' ? 'Last 24 hours' : dateRange === '30d' ? 'Last 30 days' : dateRange === 'custom' ? 'Custom range' : 'Last 7 days'} of email activity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/email-templates"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-edit-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Templates</span>
              </Link>
              <button
                onClick={handleCsvExport}
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-download-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <div className={`w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
                  <i className="ri-refresh-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 shadow-sm bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Failed to load email data</h3>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        <EmailStatsCards
          total={totalCount}
          sent={totalSent}
          failed={totalFailed}
          templateCount={allTemplates.length}
          loading={loading}
        />

        <EmailFilters
          dateRange={dateRange}
          customStart={customStart}
          customEnd={customEnd}
          statusFilter={statusFilter}
          templateFilter={templateFilter}
          templates={allTemplates}
          onDateRangeChange={setDateRange}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          onStatusChange={setStatusFilter}
          onTemplateChange={setTemplateFilter}
          onClear={clearFilters}
          hasFilters={hasFilters}
        />

        {refreshing && (
          <div className="flex items-center justify-center py-3">
            <span className="text-xs text-slate-500 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin"></span>
              Refreshing...
            </span>
          </div>
        )}

        {/* Template Stats Table */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1a2b4a]">
            <h2 className="text-sm font-bold text-white">By Template</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2b4a]">
                  <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Template</th>
                  <th className="text-center px-5 py-3 text-slate-500 font-medium text-xs">Total</th>
                  <th className="text-center px-5 py-3 text-slate-500 font-medium text-xs">Sent</th>
                  <th className="text-center px-5 py-3 text-slate-500 font-medium text-xs">Failed</th>
                  <th className="text-right px-5 py-3 text-slate-500 font-medium text-xs">Last Sent</th>
                </tr>
              </thead>
              <tbody>
                {templateStats.map((stat) => (
                  <tr key={stat.template} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/30 transition">
                    <td className="px-5 py-3">
                      <span className="text-white font-medium">{stat.template}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-slate-300">{stat.total}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-emerald-400 font-medium">{stat.sent}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {stat.failed > 0 ? (
                        <span className="text-red-400 font-medium">{stat.failed}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400 text-xs">{formatDate(stat.last_sent)}</td>
                  </tr>
                ))}
                {templateStats.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      {totalCount === 0 && !error ? 'No email data in this period' : 'No matching templates'}
                    </td>
                  </tr>
                )}
                {templateStats.length === 0 && loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
{Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-4 bg-slate-700/50 rounded animate-pulse mb-3 mx-5"></div>
                    ))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1a2b4a] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Recent Emails</h2>
            <span className="text-xs text-slate-500">{totalCount} total entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2b4a]">
                  <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Function</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Template</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Recipient</th>
                  <th className="text-center px-5 py-3 text-slate-500 font-medium text-xs">Status</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Error</th>
                  <th className="text-right px-5 py-3 text-slate-500 font-medium text-xs">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/30 transition">
                    <td className="px-5 py-3">
                      <span className="text-slate-400 text-xs">{log.function_name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-white text-xs font-medium">{log.template || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{maskEmail(log.recipient)}</td>
                    <td className="px-5 py-3 text-center">
                      {log.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowErrorModal(log)}
                          className="inline-flex items-center gap-1 text-red-400 text-xs font-medium hover:text-red-300 cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                          Failed
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      {log.error_message ? (
                        <span className="text-xs text-red-400/70 truncate block">{log.error_message.slice(0, 80)}</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-slate-500">{formatDate(log.sent_at || log.created_at)}</span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      {error ? 'Failed to load data' : totalCount === 0 ? 'No emails sent in this period' : 'No matching entries'}
                    </td>
                  </tr>
                )}
                {logs.length === 0 && loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-4 bg-slate-700/50 rounded animate-pulse mb-3 mx-5"></div>
                      ))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalCount}
            itemsPerPage={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </div>
      </main>

      {showErrorModal && (
        <ErrorDetailModal entry={showErrorModal} onClose={() => setShowErrorModal(null)} />
      )}
    </div>
  );
}