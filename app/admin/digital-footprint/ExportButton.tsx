'use client';

import { useState } from 'react';

interface ProjectRow {
  projectName: string;
  category: string;
  automatedCost: number | null;
  manualCost: number | null;
  manualBuildStatus: string | null;
  manualHealth: string | null;
  manualBlockers: string | null;
  manualRevenue: number | null;
  isArchived: boolean;
  metricUpdatedAt: string | null;
}

interface ExportButtonProps {
  projects: ProjectRow[];
}

export default function ExportButton({ projects }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportCSV = () => {
    const header = 'Project,Category,Automated Cost,Manual Cost,Revenue Estimate,Build Status,Health,Blockers,Last Updated,Archived';
    const rows = projects.map((p) => {
      const cost = p.manualCost ?? p.automatedCost ?? '';
      return [
        `"${p.projectName}"`,
        `"${p.category}"`,
        p.automatedCost ?? '',
        p.manualCost ?? '',
        p.manualRevenue ?? '',
        p.manualBuildStatus ?? '',
        p.manualHealth ?? '',
        `"${(p.manualBlockers || '').replace(/"/g, '""')}"`,
        p.metricUpdatedAt ? new Date(p.metricUpdatedAt).toISOString().split('T')[0] : '',
        p.isArchived ? 'Yes' : 'No',
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-footprint-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const exportJSON = () => {
    const data = projects.map((p) => ({
      projectName: p.projectName,
      category: p.category,
      automatedCost: p.automatedCost,
      manualCost: p.manualCost,
      revenueEstimate: p.manualRevenue,
      buildStatus: p.manualBuildStatus,
      health: p.manualHealth,
      blockers: p.manualBlockers,
      lastUpdated: p.metricUpdatedAt,
      archived: p.isArchived,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-footprint-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0a1628] text-slate-400 border border-[#1a2b4a] hover:text-white hover:border-slate-500/30 transition-all cursor-pointer whitespace-nowrap"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-download-line text-sm"></i>
        </div>
        Export
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
          <div className="absolute right-0 top-full mt-2 w-40 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-2xl z-40 overflow-hidden">
            <button
              onClick={exportCSV}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-excel-2-line text-sm"></i></div>
              Export CSV
            </button>
            <button
              onClick={exportJSON}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-code-line text-sm"></i></div>
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}