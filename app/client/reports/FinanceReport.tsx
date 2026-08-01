'use client';

import { useState, useMemo } from 'react';

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
    case 'succeeded':
    case 'paid':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    case 'pending':
    case 'pending_payment':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    case 'processing':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'failed':
      return 'bg-red-500/10 text-red-400 border-red-500/25';
    case 'refunded':
      return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
    case 'disputed':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'succeeded':
    case 'completed':
    case 'paid':
      return 'Paid';
    case 'pending':
    case 'pending_payment':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    case 'disputed':
      return 'Disputed';
    default:
      return status?.toUpperCase() || 'Unknown';
  }
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function FinanceReport({
  transactions,
  subscriptionPayments,
  client,
  reportRange,
  onToast,
}: {
  transactions: any[];
  subscriptionPayments: any[];
  client: any;
  reportRange: { from: string; to: string };
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'job' | 'subscription'>('job');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const currentData = tab === 'job' ? transactions : subscriptionPayments;

  const filtered = useMemo(() => {
    return currentData.filter((item: any) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (item.description || '').toLowerCase().includes(q) ||
          (item.id || '').toLowerCase().includes(q) ||
          (item.stripe_invoice_id || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [currentData, statusFilter, searchQuery]);

  const total = filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paidTotal = filtered.filter((i: any) => ['completed', 'succeeded', 'paid'].includes(i.status)).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const failedTotal = filtered.filter((i: any) => i.status === 'failed').reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const refundedTotal = filtered.filter((i: any) => i.refunded).reduce((sum, i) => sum + (Number(i.refund_amount) || 0), 0);

  function handleExportCsv() {
    if (filtered.length === 0) {
      onToast('No payments to export');
      return;
    }
    setExporting(true);
    try {
      const headers = tab === 'job'
        ? ['Transaction ID', 'Description', 'Amount', 'Status', 'Payment Status', 'Currency', 'Created At', 'Completed At']
        : ['Payment ID', 'Invoice ID', 'Billing Reason', 'Amount', 'Status', 'Currency', 'Period Start', 'Period End', 'Created At'];
      const lines = [headers.join(',')];
      for (const item of filtered) {
        const row = tab === 'job'
          ? [
              item.id,
              item.description,
              item.amount,
              item.status,
              item.payment_status,
              item.currency,
              item.created_at,
              item.completed_at,
            ].map(escapeCsv)
          : [
              item.id,
              item.stripe_invoice_id,
              item.billing_reason,
              item.amount,
              item.status,
              item.currency,
              item.period_start,
              item.period_end,
              item.created_at,
            ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quickguard-${tab}-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`${filtered.length} payments exported to CSV`);
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
        <div className="flex gap-2">
          <button
            onClick={() => setTab('job')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap ${
              tab === 'job' ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-400 border border-[#1e2d4d]'
            }`}
          >
            <i className="ri-briefcase-line mr-1"></i>Job Payments
          </button>
          <button
            onClick={() => setTab('subscription')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap ${
              tab === 'subscription' ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-400 border border-[#1e2d4d]'
            }`}
          >
            <i className="ri-vip-crown-line mr-1"></i>Subscriptions
          </button>
        </div>
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments..."
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
              <option value="completed">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="succeeded">Succeeded</option>
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

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <p className="text-xs text-slate-500 font-medium uppercase">Total</p>
          <p className="text-xl font-bold text-white">£{total.toFixed(2)}</p>
        </div>
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <p className="text-xs text-slate-500 font-medium uppercase">Paid</p>
          <p className="text-xl font-bold text-emerald-400">£{paidTotal.toFixed(2)}</p>
        </div>
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <p className="text-xs text-slate-500 font-medium uppercase">Failed</p>
          <p className="text-xl font-bold text-red-400">£{failedTotal.toFixed(2)}</p>
        </div>
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <p className="text-xs text-slate-500 font-medium uppercase">Refunded</p>
          <p className="text-xl font-bold text-violet-400">£{refundedTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* VAT Note */}
      {client?.vat_number && (
        <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-blue-400">
          <i className="ri-information-line"></i>
          <span>VAT registered: {client.vat_number}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-bill-line text-3xl text-slate-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No payments found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your filters or date range.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 hover:border-teal-500/25 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-white">
                      {tab === 'job' ? (item.description || 'Job Payment') : (item.billing_reason?.replace('_', ' ').toUpperCase() || 'Subscription Payment')}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                    {item.refunded && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/25">
                        Refunded
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400 mt-2 flex-wrap">
                    <span className="font-mono text-xs">{item.id.slice(0, 16)}...</span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line text-slate-500"></i>
                      {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-money-pound-circle-line text-slate-500"></i>
                      {item.currency?.toUpperCase() || 'GBP'}
                    </span>
                    {tab === 'subscription' && item.period_start && (
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-event-line text-slate-500"></i>
                        {new Date(item.period_start).toLocaleDateString('en-GB')} - {new Date(item.period_end).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                  {item.failure_reason && (
                    <p className="text-sm text-red-400 mt-2">Failure: {item.failure_reason}</p>
                  )}
                </div>
                <div className="text-right min-w-[120px]">
                  <div className="text-xl font-bold text-white">£{parseFloat(item.amount).toFixed(2)}</div>
                  <div className="text-xs text-slate-500">{tab === 'job' ? 'Job payment' : 'Subscription'}</div>
                  {item.invoice_url && (
                    <a
                      href={item.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 text-sm font-medium mt-2 inline-flex items-center gap-1"
                    >
                      <i className="ri-file-text-line"></i> Invoice
                    </a>
                  )}
                  {item.receipt_url && (
                    <a
                      href={item.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 text-sm font-medium mt-2 inline-flex items-center gap-1 ml-3"
                    >
                      <i className="ri-receipt-line"></i> Receipt
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#162036] border-b border-[#1e2d4d]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4d]">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#162036]/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200 text-sm">
                        {tab === 'job' ? (item.description || 'Job Payment') : (item.billing_reason?.replace('_', ' ').toUpperCase() || 'Subscription')}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{item.id.slice(0, 12)}...</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      £{parseFloat(item.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.invoice_url && (
                          <a href={item.invoice_url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 text-sm font-medium">
                            Invoice
                          </a>
                        )}
                        {item.receipt_url && (
                          <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
                            Receipt
                          </a>
                        )}
                      </div>
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