'use client';

import Link from 'next/link';
import { StatusBadge, SeverityBadge } from './ComplaintStatusBadge';

interface Complaint {
  id: string;
  complaint_id: string;
  filed_by_id: string;
  filed_by_type: string;
  filed_against_type: string | null;
  category: string;
  severity: string;
  description: string;
  status: string;
  created_at: string;
  related_job_id: string | null;
  filed_by_name?: string;
  filed_against_name?: string;
  job_title?: string;
}

interface Props {
  complaints: Complaint[];
  onSelect: (c: Complaint) => void;
}

export default function ComplaintsTable({ complaints, onSelect }: Props) {
  if (complaints.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#1a2b4a] rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-feedback-line text-3xl text-slate-500"></i>
        </div>
        <p className="text-lg font-semibold text-white">No complaints found</p>
        <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <tr>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Filed By</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Against</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {complaints.map(c => (
              <tr key={c.id} className="hover:bg-[#0a1628]/50 transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">{c.complaint_id}</td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-white text-sm whitespace-nowrap">{c.filed_by_name ?? '\u2014'}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{c.filed_by_type}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-white text-sm whitespace-nowrap">{c.filed_against_name ?? '\u2014'}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{c.filed_against_type ?? ''}</p>
                </td>
                <td className="px-5 py-4 text-slate-300 whitespace-nowrap text-sm">
                  {c.category.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}
                </td>
                <td className="px-5 py-4"><SeverityBadge severity={c.severity} /></td>
                <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-4 text-slate-400 text-sm whitespace-nowrap">
                  {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => onSelect(c as any)}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500/10 hover:border-teal-500/30 cursor-pointer whitespace-nowrap transition"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}