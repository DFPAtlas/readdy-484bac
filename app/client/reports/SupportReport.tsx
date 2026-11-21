'use client';

import ReportPdfButton from './ReportPdfButton';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { filterSupportReport, supportReportSummary, supportReportCsv, SUPPORT_SOURCE_LABELS, SUPPORT_STATUS_LABELS, type SupportReportRecord } from '@/lib/client-support-report';

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const badge = 'px-2 py-0.5 rounded-full text-xs font-medium border border-slate-500/25 bg-slate-500/10 text-slate-300';
const selectClass = 'px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-slate-300';

export default function SupportReport({ records, reportRange, onToast }: { records: SupportReportRecord[]; reportRange: { from: string; to: string }; onToast: (message: string) => void }) {
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [exporting, setExporting] = useState(false);
  const filtered = useMemo(() => filterSupportReport(records, { ...reportRange, source, status, priority }), [records, reportRange, source, status, priority]);
  const summary = useMemo(() => supportReportSummary(filtered), [filtered]);

  function exportCsv() {
    if (!filtered.length) { onToast('No support records to export'); return; }
    setExporting(true);
    try {
      const blob = new Blob([supportReportCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `quickguard-support-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      onToast(`${filtered.length} support record${filtered.length === 1 ? '' : 's'} exported to CSV`);
    } catch { onToast('Support export failed'); }
    finally { setExporting(false); }
  }

  return <div>
    <p className="text-sm text-slate-400 mb-4">Support tickets, complaints and job disputes are separate records. Related records may describe the same issue. Counts, rows and CSV follow the selected period and filters below.</p>
    <p className="text-xs text-slate-500 mb-4">The period uses record creation dates in the UK. Resolved and closed history remains available; deleted support tickets are excluded. Priority and severity keep their recorded values.</p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total Records', value: summary.total }, { label: 'Open', value: summary.open },
        { label: 'Awaiting Client Reply', value: summary.awaitingClient }, { label: 'Under Review', value: summary.underReview },
        { label: 'Resolved', value: summary.resolved }, { label: 'Closed', value: summary.closed },
        { label: 'Urgent / Critical (active)', value: summary.urgent }, { label: 'Active Job Disputes', value: summary.activeDisputes },
      ].map(item => <div key={item.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 text-center"><p className="text-xl font-bold text-white">{item.value}</p><p className="text-xs text-slate-400 mt-1">{item.label}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <select aria-label="Support record source" value={source} onChange={event => setSource(event.target.value)} className={selectClass}>
        <option value="all">All Sources</option>{Object.entries(SUPPORT_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Support record status" value={status} onChange={event => setStatus(event.target.value)} className={selectClass}>
        <option value="all">All Statuses</option><option value="open">Open</option><option value="awaiting_client">Awaiting Client Reply</option><option value="under_review">Under Review</option><option value="escalated">Escalated</option><option value="resolved">Resolved (all outcomes)</option><option value="closed">Closed</option>
      </select>
      <select aria-label="Support record priority or severity" value={priority} onChange={event => setPriority(event.target.value)} className={selectClass}>
        <option value="all">All Priorities / Severities</option>{['urgent', 'critical', 'high', 'normal', 'medium', 'low', 'not_recorded'].map(value => <option key={value} value={value}>{value === 'not_recorded' ? 'Not recorded' : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
      </select>
      <button type="button" onClick={() => { setSource('all'); setStatus('all'); setPriority('all'); }} className="text-sm text-teal-400 underline">Clear report filters</button>
      <button type="button" aria-label="Show support cards" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')} className={selectClass}>Cards</button>
      <button type="button" aria-label="Show support table" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} className={selectClass}>Table</button>
      <button type="button" aria-label="Export support records CSV" disabled={exporting || !filtered.length} onClick={exportCsv} className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-semibold disabled:opacity-50">CSV</button>
      <ReportPdfButton filename="quickguard-support" disabled={exporting || !filtered.length} onToast={onToast} report={() => ({ title: 'Support and disputes', columns: ['Source', 'Reference', 'Subject', 'Priority', 'Status', 'Created (UK)', 'Resolved (UK)', 'Job'], rows: filtered.map(row => [SUPPORT_SOURCE_LABELS[row.source], row.reference, row.subject, row.priority, SUPPORT_STATUS_LABELS[row.status] || row.status, formatDate(row.createdAt), formatDate(row.resolvedAt), row.jobId]) })} />
      <button type="button" onClick={() => window.print()} className={selectClass}>Print</button>
      <Link href="/client/support" className="text-sm text-teal-400 underline">Open Support Centre</Link>
    </div>
    <p className="text-xs text-slate-400 mb-4">{summary.total} record{summary.total === 1 ? '' : 's'}: {summary.tickets} support ticket{summary.tickets === 1 ? '' : 's'}, {summary.complaints} complaint{summary.complaints === 1 ? '' : 's'}, {summary.disputes} job dispute{summary.disputes === 1 ? '' : 's'}.</p>
    {!filtered.length ? <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-10 text-center"><h3 className="text-lg font-semibold text-white">No support records match these filters</h3><p className="text-sm text-slate-400 mt-2">Try All Time or clear the source, status and priority filters.</p></div> : viewMode === 'table' ? <div className="overflow-x-auto rounded-xl border border-[#1e2d4d]"><table className="w-full text-left text-sm text-slate-300"><thead className="bg-[#162036]"><tr>{['Source', 'Reference', 'Subject', 'Priority / Severity', 'Status', 'Created (UK)', 'Resolved (UK)', 'Job'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.key} className="border-t border-[#1e2d4d]"><td className="px-4 py-3">{SUPPORT_SOURCE_LABELS[row.source]}</td><td className="px-4 py-3 font-mono">{row.reference}</td><td className="px-4 py-3">{row.subject}</td><td className="px-4 py-3">{row.priority === 'not_recorded' ? 'Not recorded' : row.priority}</td><td className="px-4 py-3">{SUPPORT_STATUS_LABELS[row.status] || row.status}</td><td className="px-4 py-3">{formatDate(row.createdAt)}</td><td className="px-4 py-3">{formatDate(row.resolvedAt)}</td><td className="px-4 py-3">{row.jobId ? <Link href={`/client/jobs/detail?id=${encodeURIComponent(row.jobId)}`} className="text-teal-400">View job</Link> : 'No linked job'}</td></tr>)}</tbody></table></div> : <div className="space-y-3">{filtered.map(row => <article key={row.key} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5">
      <div className="flex flex-wrap gap-2 mb-3"><span className={badge}>{SUPPORT_SOURCE_LABELS[row.source]}</span><span className="text-xs font-mono text-slate-400">{row.reference}</span><span className={badge}>{row.priority === 'not_recorded' ? 'Priority not recorded' : row.priority}</span><span className={badge}>{SUPPORT_STATUS_LABELS[row.status] || row.status}</span></div>
      <h3 className="text-base font-semibold text-white mb-2">{row.subject}</h3><p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{row.description}</p>
      <p className="text-xs text-slate-400">{row.category} · Created {formatDate(row.createdAt)} (UK){row.resolvedAt ? ` · Resolved ${formatDate(row.resolvedAt)} (UK)` : ''}</p>
      {row.jobId ? <Link href={`/client/jobs/detail?id=${encodeURIComponent(row.jobId)}`} className="inline-block mt-3 text-sm text-teal-400 underline">View related job</Link> : <p className="mt-3 text-xs text-slate-500">No linked job</p>}
      {row.resolution && <div className="mt-3 bg-[#162036] rounded-lg p-3"><p className="text-xs text-slate-500 uppercase">Resolution</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{row.resolution}</p></div>}
    </article>)}</div>}
  </div>;
}
