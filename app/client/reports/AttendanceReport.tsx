'use client';

import { useState, useMemo } from 'react';

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    case 'confirmed': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/25';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function AttendanceReport({
  assignments,
  jobs,
  reportRange,
  onToast,
}: {
  assignments: any[];
  jobs: any[];
  reportRange: { from: string; to: string };
  onToast: (msg: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [guardFilter, setGuardFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const guardsList = useMemo(() => {
    const all = assignments.map(a => a.guards?.full_name).filter(Boolean);
    return [...new Set(all)];
  }, [assignments]);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (guardFilter && a.guards?.full_name !== guardFilter) return false;
      const job = jobs.find(j => j.id === a.job_id);
      if (reportRange.from && job?.start_date && job.start_date < reportRange.from) return false;
      if (reportRange.to && job?.start_date && job.start_date > reportRange.to) return false;
      return true;
    });
  }, [assignments, statusFilter, guardFilter, jobs, reportRange]);

  const jobMap = useMemo(() => {
    return Object.fromEntries(jobs.map(j => [j.id, j]));
  }, [jobs]);

  function handleExportCsv() {
    if (filtered.length === 0) {
      onToast('No attendance records to export');
      return;
    }
    setExporting(true);
    try {
      const headers = [
        'Guard Name', 'Job Title', 'Shift Date', 'Scheduled Start', 'Scheduled End',
        'Check-in Time', 'Check-out Time', 'Assigned Status', 'Payment Status', 'Payment Amount',
      ];
      const lines = [headers.join(',')];
      for (const a of filtered) {
        const job = jobMap[a.job_id];
        const row = [
          a.guards?.full_name || 'Guard',
          job?.job_title || 'N/A',
          job?.start_date || 'N/A',
          job?.start_time || 'N/A',
          job?.end_time || 'N/A',
          a.assigned_at ? new Date(a.assigned_at).toLocaleString('en-GB') : 'N/A',
          a.completed_at ? new Date(a.completed_at).toLocaleString('en-GB') : 'N/A',
          a.status,
          a.payment_status || 'N/A',
          a.payment_amount || 'N/A',
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quickguard-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`${filtered.length} records exported to CSV`);
    } catch {
      onToast('Export failed');
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      {/* Clock-in note */}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-4 mb-6 flex items-start gap-3">
        <i className="ri-timer-line text-amber-400 text-xl mt-0.5"></i>
        <div>
          <p className="text-sm font-medium text-amber-400">Clock-in tracking not yet available</p>
          <p className="text-sm text-slate-400 mt-1">
            This report shows assigned guards and scheduled shifts. Real-time clock-in and clock-out data will be available once the guard mobile app clock-in feature is deployed.
          </p>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky top-16 z-10 bg-[#0B1933]/95 backdrop-blur-sm border-y border-[#1e2d4d] -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <select
              value={guardFilter}
              onChange={(e) => setGuardFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="">All Guards</option>
              {guardsList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center bg-[#162036] rounded-lg border border-[#1e2d4d] overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm cursor-pointer ${viewMode === 'cards' ? 'bg-teal-500 text-white' : 'text-slate-400'}`}
            >
              <i className="ri-layout-grid-line"></i>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm cursor-pointer ${viewMode === 'table' ? 'bg-teal-500 text-white' : 'text-slate-400'}`}
            >
              <i className="ri-table-line"></i>
            </button>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <i className={`ri-download-line ${exporting ? 'animate-pulse' : ''}`}></i>
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
          >
            <i className="ri-printer-line"></i>
            Print
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
        <span>{filtered.length} shifts</span>
        <span className="text-[#1e2d4d]">|</span>
        <span>{guardsList.length} unique guards</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-time-line text-3xl text-slate-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No attendance records</h3>
          <p className="text-slate-500 text-sm">No guards assigned yet, or all records are filtered out.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.map((a) => {
            const job = jobMap[a.job_id];
            return (
              <div key={a.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 hover:border-teal-500/25 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{a.guards?.full_name || 'Guard'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(a.status)}`}>
                        {a.status || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <i className="ri-briefcase-line text-slate-500"></i>
                        {job?.job_title || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line text-slate-500"></i>
                        {job?.start_date || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-time-line text-slate-500"></i>
                        {job?.start_time || 'N/A'} - {job?.end_time || 'N/A'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-xs text-slate-500 font-medium uppercase">Check-in</p>
                        <p className="text-sm text-slate-300 mt-1">
                          {a.assigned_at
                            ? new Date(a.assigned_at).toLocaleString('en-GB')
                            : (
                              <span className="text-amber-400 flex items-center gap-1">
                                <i className="ri-timer-flash-line"></i>
                                Scheduled — no clock-in yet
                              </span>
                            )
                          }
                        </p>
                      </div>
                      <div className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-xs text-slate-500 font-medium uppercase">Check-out</p>
                        <p className="text-sm text-slate-300 mt-1">
                          {a.completed_at
                            ? new Date(a.completed_at).toLocaleString('en-GB')
                            : (
                              <span className="text-slate-500 flex items-center gap-1">
                                <i className="ri-timer-line"></i>
                                Not completed yet
                              </span>
                            )
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right min-w-[120px]">
                    {a.payment_amount && (
                      <div className="text-lg font-bold text-white">£{parseFloat(a.payment_amount).toFixed(2)}</div>
                    )}
                    <div className="text-xs text-slate-500">{a.payment_status || 'No payment'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#162036] border-b border-[#1e2d4d]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Guard</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Shift Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Scheduled</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4d]">
                {filtered.map((a) => {
                  const job = jobMap[a.job_id];
                  return (
                    <tr key={a.id} className="hover:bg-[#162036]/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200 text-sm">{a.guards?.full_name || 'Guard'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{job?.job_title || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{job?.start_date || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {job?.start_time || 'N/A'} - {job?.end_time || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {a.assigned_at ? new Date(a.assigned_at).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {a.completed_at ? new Date(a.completed_at).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(a.status)}`}>
                          {a.status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}