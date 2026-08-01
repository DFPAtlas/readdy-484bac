'use client';

import { useState } from 'react';

interface ActivityEntry {
  id: string;
  action_type: string;
  action_description: string;
  category: string;
  related_job_id: string | null;
  related_payment_id: string | null;
  related_ticket_id: string | null;
  related_guard_id: string | null;
  related_site_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  job_title?: string | null;
  ticket_subject?: string | null;
  guard_name?: string | null;
  site_name?: string | null;
}

interface ActivityExportModalProps {
  activities: ActivityEntry[];
  onClose: () => void;
}

export default function ActivityExportModal({ activities, onClose }: ActivityExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'json' | 'print'>('csv');
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const getFilteredActivities = () => {
    if (dateRange === 'all') return activities;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return activities.filter(a => {
      const d = new Date(a.created_at);
      if (dateRange === 'today') return d >= startOfDay;
      if (dateRange === 'week') return d >= startOfWeek;
      if (dateRange === 'month') return d >= startOfMonth;
      return true;
    });
  };

  const exportToCSV = () => {
    const data = getFilteredActivities();
    const headers = ['Date', 'Time', 'Category', 'Action Type', 'Description', 'Related Job', 'Related Ticket', 'Related Guard', 'Related Site', 'IP Address'];
    const rows = data.map(a => {
      const d = new Date(a.created_at);
      return [
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString('en-GB'),
        a.category,
        a.action_type,
        a.action_description,
        a.job_title || a.related_job_id || '-',
        a.ticket_subject || a.related_ticket_id || '-',
        a.guard_name || a.related_guard_id || '-',
        a.site_name || a.related_site_id || '-',
        a.ip_address || '-',
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickguard-activity-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const data = getFilteredActivities();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickguard-activity-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printActivity = () => {
    const data = getFilteredActivities();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>QuickGuard Activity Log</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; background: #fff; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { color: #666; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            tr:hover { background: #f8fafc; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
          </style>
        </head>
        <body>
          <h1>QuickGuard Activity Log</h1>
          <p>Exported on ${new Date().toLocaleString('en-GB')}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Action</th>
                <th>Description</th>
                <th>Related</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(a => `
                <tr>
                  <td>${new Date(a.created_at).toLocaleString('en-GB')}</td>
                  <td><span class="badge" style="background:${getCategoryColor(a.category)}">${a.category}</span></td>
                  <td>${a.action_type}</td>
                  <td>${a.action_description}</td>
                  <td>${a.job_title || a.ticket_subject || a.guard_name || a.site_name || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const getCategoryColor = (category: string) => {
    const map: Record<string, string> = {
      account: '#dbeafe', job: '#ccfbf1', applicant: '#ede9fe', guard: '#d1fae5',
      payment: '#fef3c7', message: '#e0f2fe', support: '#ffedd5', cancellation: '#fee2e2',
      refund: '#ffe4e6', document: '#e0e7ff', site: '#cffafe', review: '#fef9c3',
    };
    return map[category] || '#f1f5f9';
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      if (format === 'csv') exportToCSV();
      else if (format === 'json') exportToJSON();
      else printActivity();
      setExporting(false);
      onClose();
    }, 500);
  };

  const filteredCount = getFilteredActivities().length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-[#1e2d4d]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Export Activity Log</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-400 text-lg"></i>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">Export Format</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'csv', icon: 'ri-file-list-3-line', label: 'CSV' },
                { key: 'json', icon: 'ri-braces-line', label: 'JSON' },
                { key: 'print', icon: 'ri-printer-line', label: 'Print' },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                    format === f.key
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-[#1e2d4d] bg-[#162036] hover:border-slate-600'
                  }`}
                >
                  <i className={`${f.icon} text-xl ${format === f.key ? 'text-teal-400' : 'text-slate-400'}`}></i>
                  <span className={`text-sm font-medium ${format === f.key ? 'text-teal-400' : 'text-slate-400'}`}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">Date Range</p>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
              ] as const).map((r) => (
                <button
                  key={r.key}
                  onClick={() => setDateRange(r.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    dateRange === r.key
                      ? 'bg-teal-500 text-slate-900'
                      : 'bg-[#162036] border border-[#1e2d4d] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Records to export</span>
              <span className="text-white font-semibold">{filteredCount}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filteredCount === 0}
            className="flex-1 px-4 py-2.5 bg-teal-500 text-slate-900 rounded-xl text-sm font-semibold hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <i className="ri-download-2-line"></i>
                Export {filteredCount} Records
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}