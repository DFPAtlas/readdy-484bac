'use client';

import { useState, useMemo } from 'react';

function getSiaStatus(expiryDate: string | null) {
  if (!expiryDate) return { label: 'Missing', color: 'bg-red-500/10 text-red-400 border-red-500/25' };
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return { label: 'Expired', color: 'bg-red-500/10 text-red-400 border-red-500/25' };
  if (days <= 30) return { label: 'Expiring Soon', color: 'bg-amber-500/10 text-amber-400 border-amber-500/25' };
  return { label: 'Valid', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' };
}

function getComplianceScore(guard: any) {
  let score = 0;
  if (guard.sia_verified) score += 40;
  if (guard.sia_expiry_date && new Date(guard.sia_expiry_date) > new Date()) score += 30;
  if (guard.licence_types && guard.licence_types.length > 0) score += 20;
  if (guard.is_active) score += 10;
  return score;
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ComplianceReport({
  guards,
  jobs,
  assignments,
  onToast,
}: {
  guards: any[];
  jobs: any[];
  assignments: any[];
  onToast: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'verified' | 'expiring' | 'missing' | 'compliance_issue'>('all');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const jobGuards = useMemo(() => {
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
    return assignments.map(a => {
      const g = guards.find(g => g.id === a.guard_id);
      const j = jobMap[a.job_id];
      return { assignment: a, guard: g, job: j };
    }).filter(x => x.guard);
  }, [guards, jobs, assignments]);

  const filtered = useMemo(() => {
    return jobGuards.filter(({ guard }) => {
      const status = getSiaStatus(guard.sia_expiry_date);
      if (filter === 'verified') return guard.sia_verified && status.label === 'Valid';
      if (filter === 'expiring') return status.label === 'Expiring Soon';
      if (filter === 'missing') return !guard.sia_expiry_date || status.label === 'Expired';
      if (filter === 'compliance_issue') return !guard.sia_verified || status.label === 'Expired' || status.label === 'Missing';
      return true;
    });
  }, [jobGuards, filter]);

  const summary = useMemo(() => {
    const total = jobGuards.length;
    const verified = jobGuards.filter(({ guard }) => guard.sia_verified && getSiaStatus(guard.sia_expiry_date).label === 'Valid').length;
    const expiring = jobGuards.filter(({ guard }) => getSiaStatus(guard.sia_expiry_date).label === 'Expiring Soon').length;
    const missing = jobGuards.filter(({ guard }) => ['Missing', 'Expired'].includes(getSiaStatus(guard.sia_expiry_date).label)).length;
    const unverified = jobGuards.filter(({ guard }) => !guard.sia_verified).length;
    return { total, verified, expiring, missing, unverified };
  }, [jobGuards]);

  function handleExportCsv() {
    if (filtered.length === 0) {
      onToast('No compliance records to export');
      return;
    }
    setExporting(true);
    try {
      const headers = [
        'Guard Name', 'SIA Licence', 'SIA Expiry', 'SIA Status', 'Verified',
        'Licence Types', 'Job', 'Job Licence Required', 'Compliance Score', 'Compliance %',
      ];
      const lines = [headers.join(',')];
      for (const { guard, job } of filtered) {
        const status = getSiaStatus(guard.sia_expiry_date);
        const score = getComplianceScore(guard);
        const row = [
          guard.full_name,
          guard.sia_licence_number || 'N/A',
          guard.sia_expiry_date || 'N/A',
          status.label,
          guard.sia_verified ? 'Yes' : 'No',
          (guard.licence_types || []).join('; '),
          job?.job_title || 'N/A',
          (job?.required_licence_types || []).join('; '),
          score,
          `${score}%`,
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quickguard-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
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
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Guards', value: summary.total, color: 'text-teal-400' },
          { label: 'SIA Verified', value: summary.verified, color: 'text-emerald-400' },
          { label: 'Expiring Soon', value: summary.expiring, color: 'text-amber-400' },
          { label: 'Missing/Expired', value: summary.missing, color: 'text-red-400' },
          { label: 'Unverified', value: summary.unverified, color: 'text-slate-400' },
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
          {[
            { key: 'all', label: 'All Guards' },
            { key: 'verified', label: 'SIA Verified' },
            { key: 'expiring', label: 'Expiring Soon' },
            { key: 'missing', label: 'Missing/Expired' },
            { key: 'compliance_issue', label: 'Needs Attention' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'bg-teal-500 text-white'
                  : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
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
            <i className="ri-shield-check-line text-3xl text-slate-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No compliance issues</h3>
          <p className="text-slate-500 text-sm">All guards are compliant with current requirements.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.map(({ guard, job }) => {
            const status = getSiaStatus(guard.sia_expiry_date);
            const score = getComplianceScore(guard);
            const licenceMatch = job?.required_licence_types && guard.licence_types
              ? job.required_licence_types.some((lt: string) => guard.licence_types.includes(lt))
              : true;
            return (
              <div key={guard.id + job?.id} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 hover:border-teal-500/25 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{guard.full_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                      {!guard.sia_verified && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/25">
                          Unverified
                        </span>
                      )}
                      {!licenceMatch && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/25">
                          Licence Mismatch
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <i className="ri-briefcase-line text-slate-500"></i>
                        {job?.job_title || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-shield-star-line text-slate-500"></i>
                        {guard.sia_licence_number || 'No licence'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-calendar-line text-slate-500"></i>
                        {guard.sia_expiry_date ? `Expires ${guard.sia_expiry_date}` : 'No expiry date'}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-file-list-line text-slate-500"></i>
                        {(guard.licence_types || []).join(', ') || 'No licence types'}
                      </span>
                    </div>
                    {job?.required_licence_types && guard.licence_types && (
                      <div className="mt-2 text-sm">
                        <span className="text-slate-500">Job requires: </span>
                        <span className="text-slate-400">{job.required_licence_types.join(', ')}</span>
                        <span className="text-slate-500 mx-2">|</span>
                        <span className="text-slate-500">Guard has: </span>
                        <span className={`${licenceMatch ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {guard.licence_types.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-[120px]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{score}%</div>
                      <div className="text-xs text-slate-500">Compliance</div>
                    </div>
                    <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${
                      score >= 80 ? 'border-emerald-500 text-emerald-400' :
                      score >= 50 ? 'border-amber-500 text-amber-400' :
                      'border-red-500 text-red-400'
                    }`}>
                      <span className="text-xs font-bold">{score}</span>
                    </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">SIA Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Licence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Expiry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4d]">
                {filtered.map(({ guard, job }) => {
                  const status = getSiaStatus(guard.sia_expiry_date);
                  const score = getComplianceScore(guard);
                  return (
                    <tr key={guard.id + job?.id} className="hover:bg-[#162036]/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200 text-sm">{guard.full_name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{job?.job_title || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {guard.sia_licence_number || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {guard.sia_expiry_date || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${
                          score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {score}%
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