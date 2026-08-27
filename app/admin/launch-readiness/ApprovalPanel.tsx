'use client';

import { useState } from 'react';
import type { Decision, SavedDecision } from './types';

interface Props {
  decision: Decision;
  adminName: string;
  canApprove: boolean;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  history: SavedDecision[];
  onSave: (notes: string, confirmed: boolean) => void;
}

export default function ApprovalPanel({
  decision,
  adminName,
  canApprove,
  saving,
  saveError,
  saveSuccess,
  history,
  onSave,
}: Props) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');

  const config = {
    'GO': 'text-emerald-400',
    'CONDITIONAL GO': 'text-amber-400',
    'NO-GO': 'text-red-400',
  }[decision];

  return (
    <section className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-400">
          <i className="ri-shield-check-line text-xl"></i>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Final launch approval</h2>
          <p className="text-sm text-slate-400 mt-0.5">Record and formally approve the launch decision.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-[#0e1a2e] border border-[#1a2b4a] p-4 mb-5">
        <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">Decision:</span>
        <span className={`text-xl font-extrabold tracking-tight ${config}`}>{decision}</span>
      </div>

      {!canApprove && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-5">
          <p className="text-sm text-amber-300">
            You have view access. Only a Super Admin or Admin can approve and save the launch decision.
          </p>
        </div>
      )}

      {canApprove && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Launch notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Any notes, conditions, or caveats for this launch decision..."
              className="w-full bg-[#0e1a2e] border border-[#1a2b4a] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Approved by</label>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder={adminName || 'Administrator name'}
              className="w-full bg-[#0e1a2e] border border-[#1a2b4a] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="text-sm text-slate-500">
            Approval date &amp; time: <span className="text-slate-300 font-medium">{new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-[#0e1a2e] border border-[#1a2b4a] p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer"
            />
            <span className="text-sm text-slate-300">
              I confirm the launch decision above is correct and I am authorised to approve it.
            </span>
          </label>

          {saveError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-300">{saveError}</div>
          )}
          {saveSuccess && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-sm text-emerald-300">
              Launch decision saved and recorded in the audit log.
            </div>
          )}

          <button
            onClick={() => onSave(notes, confirmed)}
            disabled={saving || !confirmed}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-900/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <div className={`w-4 h-4 flex items-center justify-center ${saving ? 'animate-spin' : ''}`}>
              <i className="ri-save-line text-sm"></i>
            </div>
            {saving ? 'Saving...' : 'Save decision'}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 pt-5 border-t border-[#1a2b4a]">
          <h3 className="text-sm font-bold text-white mb-3">Approval history</h3>
          <div className="space-y-2">
            {history.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0e1a2e] border border-[#1a2b4a] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-extrabold ${
                    d.decision === 'GO' ? 'text-emerald-400' : d.decision === 'CONDITIONAL GO' ? 'text-amber-400' : 'text-red-400'
                  }`}>{d.decision}</span>
                  <span className="text-xs text-slate-500">
                    {d.approved_by || d.approved_by_email || 'Unknown'} · {new Date(d.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {d.notes && <span className="text-xs text-slate-400 italic">{d.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}