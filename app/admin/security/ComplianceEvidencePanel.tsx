'use client';

import { useState } from 'react';
import type { ComplianceRecord } from './SecuritySOCClient';
import IcoRegistrationForm from './IcoRegistrationForm';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return 'Not recorded';
  return new Date(parsed).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed < Date.now();
}

export default function ComplianceEvidencePanel({ item, onUpdated }: { item: ComplianceRecord; onUpdated: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const overdue = isOverdue(item.renewal_due_at);

  return (
    <div className="mt-2 pl-8 pr-1 border-t border-[#1a2b4a] pt-2.5 space-y-2.5">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Evidence notes</p>
        <p className="text-[11px] leading-relaxed text-slate-400">{item.notes || 'No evidence notes recorded yet.'}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Last reviewed</p>
          <p className="text-[11px] text-slate-300" suppressHydrationWarning>{formatDate(item.last_reviewed_at)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Reference</p>
          <p className="text-[11px] text-slate-300 break-words">{item.evidence_reference || 'Not recorded'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Renewal due</p>
          <p className={`text-[11px] ${overdue ? 'text-amber-400' : 'text-slate-300'}`} suppressHydrationWarning>
            {formatDate(item.renewal_due_at)}{overdue ? ' · overdue' : ''}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Published evidence</p>
          {item.evidence_url ? (
            <a href={item.evidence_url} className="text-[11px] text-cyan-400 hover:text-cyan-300 transition cursor-pointer inline-flex items-center gap-1">
              <i className="ri-external-link-line text-[11px]"></i>
              Open page
            </a>
          ) : (
            <p className="text-[11px] text-slate-500">No link recorded</p>
          )}
        </div>
      </div>

      {item.key === 'ico' && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer whitespace-nowrap"
            >
              <i className="ri-edit-line text-[12px]"></i>
              Record ICO registration
            </button>
          ) : (
            <IcoRegistrationForm item={item} onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); onUpdated(); }} />
          )}
        </div>
      )}
    </div>
  );
}