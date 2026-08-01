'use client';

import { useState, useMemo } from 'react';

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'urgent': return 'bg-red-500/10 text-red-400 border-red-500/25';
    case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
    case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'resolved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    case 'under_review': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'open': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    case 'escalated': return 'bg-red-500/10 text-red-400 border-red-500/25';
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

export default function SupportReport({
  complaints,
  reportRange,
  onToast,
}: {
  complaints: any[];
  reportRange: { from: string; to: string };
  onToast: (msg: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
      return true;
    });
  }, [complaints, statusFilter, severityFilter]);

  const summary = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter(c => c.status === 'open').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    urgent: complaints.filter(c => c.severity === 'urgent').length,
  }), [complaints]);

  function handleExportCsv() {
    if (filtered.length === 0) {
      onToast('No complaints to export');
      return;
    }
    setExporting(true);
    try {
      const headers = ['Complaint ID', 'Category', 'Severity', 'Status', 'Description', 'Created At', 'Resolved At', 'Resolution Notes'];
      const lines = [headers.join(',')];
      for (const c of filtered) {
        const row = [
          c.complaint_id,
          c.category,
          c.severity,
          c.status,
          c.description,
          c.created_at,
          c.resolved_at,
          c.resolution_notes,
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quickguard-support-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`${filtered.length} complaints exported to CSV`);
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
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: summary.total, color: 'text-teal-400' },
          { label: 'Open', value: summary.open, color: 'text-amber-400' },
          { label: 'Resolved', value: summary.resolved, color: 'text-emerald-400' },
          { label: 'Urgent', value: summary.urgent, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 text-center">
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sticky action bar */}
      <div className="sticky top-16 z-10 bg-[#0B1933]/95 backdrop-blur-sm border-y border-[#1e2d4d] -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex gap-2 flex-wrap">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="pl-3 pr-8 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
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

      {filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-customer-service-2-line text-3xl text-slate-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No complaints found</h3>
          <p className="text-slate-500 text-sm">No support tickets or disputes match your filters.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 hover:border-teal-500/25 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-500">{c.complaint_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(c.severity)}`}>
                      {c.severity?.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(c.status)}`}>
                      {c.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{c.description}</p>
                  <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <i className="ri-folder-line text-slate-500"></i>
                      {c.category || 'General'}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line text-slate-500"></i>
                      {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </span>
                    {c.resolved_at && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <i className="ri-check-double-line"></i>
                        Resolved {new Date(c.resolved_at).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {c.resolution_notes && (
                <div className="mt-3 bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
                  <p className="text-xs text-slate-500 font-medium uppercase">Resolution</p>
                  <p className="text-sm text-slate-400 mt-1">{c.resolution_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#162036] border-b border-[#1e2d4d]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4d]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#162036]/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.complaint_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{c.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(c.severity)}`}>
                        {c.severity?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(c.status)}`}>
                        {c.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {c.resolved_at ? new Date(c.resolved_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}