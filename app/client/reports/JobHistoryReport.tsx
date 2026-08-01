'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  open: 'Posted',
  pending: 'Pending',
  awaiting_guard_selection: 'Applications Open',
  awaiting_payment: 'Awaiting Payment',
  in_progress: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pending',
  completed: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  disputed: 'Disputed',
  none: 'None',
};

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'awaiting_payment': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    case 'awaiting_guard_selection': return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
    case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/25';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
}

function getPaymentColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/25';
    case 'refunded': return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
    case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
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

export default function JobHistoryReport({ jobs, reportRange, onToast }: { jobs: any[]; reportRange: { from: string; to: string }; onToast: (msg: string) => void }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const locations = useMemo(() => {
    const all = jobs.map(j => j.venue_city).filter(Boolean);
    return [...new Set(all)];
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter(job => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (locationFilter && job.venue_city !== locationFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (job.job_title || '').toLowerCase().includes(q) ||
          (job.venue_name || '').toLowerCase().includes(q) ||
          (job.venue_city || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobs, statusFilter, locationFilter, searchQuery]);

  const totalCost = filtered.reduce((sum, j) => {
    const assigned = j.job_assignments?.length || 0;
    const rate = Number(j.hourly_rate) || 0;
    const hours = j.start_time && j.end_time ? estimateHours(j.start_time, j.end_time) : 0;
    return sum + (hours * rate * assigned);
  }, 0);

  function estimateHours(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let h = (eh + em / 60) - (sh + sm / 60);
    if (h < 0) h += 24;
    return h;
  }

  function handleExportCsv() {
    if (filtered.length === 0) {
      onToast('No jobs to export');
      return;
    }
    setExporting(true);
    try {
      const headers = [
        'Job ID', 'Job Title', 'Status', 'Venue', 'City', 'Postcode',
        'Start Date', 'End Date', 'Start Time', 'End Time',
        'Guards Required', 'Guards Selected', 'Hourly Rate', 'Estimated Total',
        'Site Instructions', 'Created At',
      ];
      const lines = [headers.join(',')];
      for (const job of filtered) {
        const assigned = job.job_assignments?.length || 0;
        const rate = Number(job.hourly_rate) || 0;
        const hours = job.start_time && job.end_time ? estimateHours(job.start_time, job.end_time) : 0;
        const est = hours * rate * assigned;
        const row = [
          job.id,
          job.job_title,
          STATUS_LABELS[job.status] || job.status,
          job.venue_name,
          job.venue_city,
          job.venue_postcode,
          job.start_date,
          job.end_date || job.start_date,
          job.start_time,
          job.end_time,
          job.number_of_guards,
          assigned,
          `£${rate.toFixed(2)}`,
          `£${est.toFixed(2)}`,
          job.site_instructions,
          job.created_at,
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quickguard-job-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`${filtered.length} jobs exported to CSV`);
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
      {/* Sticky action bar */}
      <div className="sticky top-16 z-10 bg-[#0B1933]/95 backdrop-blur-sm border-y border-[#1e2d4d] -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Posted</option>
              <option value="pending">Pending</option>
              <option value="awaiting_guard_selection">Applications Open</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="in_progress">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center bg-[#162036] rounded-lg border border-[#1e2d4d] overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm cursor-pointer ${viewMode === 'cards' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <i className="ri-layout-grid-line"></i>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm cursor-pointer ${viewMode === 'table' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
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
          {/* TODO: PDF export */}
          <button
            disabled
            className="hidden lg:flex items-center gap-2 bg-[#162036] text-slate-600 text-sm font-semibold px-4 py-2 rounded-lg cursor-not-allowed whitespace-nowrap border border-[#1e2d4d]"
            title="PDF export coming soon"
          >
            <i className="ri-file-pdf-line"></i>
            PDF
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
        <span>{filtered.length} jobs</span>
        <span className="text-[#1e2d4d]">|</span>
        <span>Est. total: <span className="text-white font-semibold">£{totalCost.toFixed(2)}</span></span>
        {(reportRange.from || reportRange.to) && (
          <>
            <span className="text-[#1e2d4d]">|</span>
            <span>{reportRange.from || 'Start'} to {reportRange.to || 'End'}</span>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-briefcase-line text-3xl text-slate-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No jobs found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your filters or date range.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.map((job) => {
            const assigned = job.job_assignments?.length || 0;
            const rate = Number(job.hourly_rate) || 0;
            const hours = job.start_time && job.end_time ? estimateHours(job.start_time, job.end_time) : 0;
            const est = hours * rate * assigned;
            return (
              <div key={job.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 hover:border-teal-500/25 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{job.job_title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                        {STATUS_LABELS[job.status] || job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <i className="ri-map-pin-line text-slate-500"></i>
                        {job.venue_name || 'N/A'}, {job.venue_city || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line text-slate-500"></i>
                        {job.start_date} {job.start_time ? `at ${job.start_time}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-shield-user-line text-slate-500"></i>
                        {assigned}/{job.number_of_guards} guards
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-money-pound-circle-line text-slate-500"></i>
                        £{rate.toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {job.job_assignments?.map((a: any) => (
                        <span key={a.id} className="px-2 py-1 bg-[#162036] rounded-lg text-xs text-slate-400 border border-[#1e2d4d] flex items-center gap-1">
                          <i className="ri-user-line text-slate-500"></i>
                          {a.guards?.full_name || 'Guard'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 min-w-[140px]">
                    <div className="text-lg font-bold text-white">£{est.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Estimated total</div>
                    <Link
                      href={`/client/jobs/${job.id}`}
                      className="text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-1 cursor-pointer"
                    >
                      View Details <i className="ri-arrow-right-line"></i>
                    </Link>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Guards</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Est. Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4d]">
                {filtered.map((job) => {
                  const assigned = job.job_assignments?.length || 0;
                  const rate = Number(job.hourly_rate) || 0;
                  const hours = job.start_time && job.end_time ? estimateHours(job.start_time, job.end_time) : 0;
                  const est = hours * rate * assigned;
                  return (
                    <tr key={job.id} className="hover:bg-[#162036]/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200 text-sm">{job.job_title}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {job.venue_city || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {job.start_date}<br />{job.start_time}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {assigned}/{job.number_of_guards}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        £{rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        £{est.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/client/jobs/${job.id}`}
                          className="text-teal-400 hover:text-teal-300 text-sm font-medium cursor-pointer"
                        >
                          View
                        </Link>
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