'use client';

import { useState } from 'react';
import type { ComplianceRecord } from './SecuritySOCClient';
import ComplianceEvidencePanel from './ComplianceEvidencePanel';

const ICONS: Record<string, string> = {
  gdpr: 'ri-shield-check-line',
  ico: 'ri-government-line',
  privacy_policy: 'ri-file-text-line',
  terms: 'ri-file-list-2-line',
  cookie_policy: 'ri-shield-flash-line',
  data_retention: 'ri-archive-line',
  data_deletion: 'ri-delete-back-line',
  encryption: 'ri-lock-password-line',
  audit_logging: 'ri-survey-line',
  sia_compliance: 'ri-police-car-line',
};

interface Props {
  item: ComplianceRecord;
  onUpdated: () => void;
}

export default function ComplianceRecordRow({ item, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const status = item.status || 'missing';
  const colors = status === 'complete'
    ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'ri-check-fill' }
    : status === 'review'
      ? { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'ri-time-fill' }
      : { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'ri-close-fill' };

  return (
    <div className={`bg-[#0a1628] rounded-lg border transition ${open ? 'border-cyan-500/30' : 'border-[#1a2b4a]'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-6 h-6 flex items-center justify-center rounded shrink-0 ${colors.bg}`}>
            <i className={`${ICONS[item.key] || 'ri-file-shield-2-line'} text-xs ${colors.text}`}></i>
          </div>
          <span className="text-sm text-slate-300 group-hover:text-white transition">{item.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${colors.bg} ${colors.text}`}>
            <i className={`${colors.icon} text-[10px] mr-0.5`}></i>
            {status === 'complete' ? 'Complete' : status === 'review' ? 'Needs Review' : 'Missing'}
          </span>
        </div>
        <i className={`${open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-slate-500 group-hover:text-slate-300 transition shrink-0`}></i>
      </button>

      {open && <div className="px-3 pb-3"><ComplianceEvidencePanel item={item} onUpdated={onUpdated} /></div>}
    </div>
  );
}