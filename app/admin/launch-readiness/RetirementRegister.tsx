'use client';

import { useState } from 'react';
import type { RetirementRecord, RetirementApproval, RetirementDecision } from './types';

const CLASS_META: Record<string, { label: string; cls: string }> = {
  needs_verification: { label: 'Needs human verification', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
  retired_removable: { label: 'Retired — safely removable', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  retired_disabled: { label: 'Retired — kept disabled', cls: 'bg-sky-500/10 text-sky-400 ring-sky-500/20' },
  active: { label: 'Active', cls: 'bg-slate-500/10 text-slate-300 ring-slate-500/20' },
};

const DECISION_LABEL: Record<string, string> = {
  delete: 'Delete',
  disable: 'Disable',
  keep: 'Keep',
};

interface Props {
  register: RetirementRecord[];
  approvals: RetirementApproval[];
  canApprove: boolean;
  approving: boolean;
  onApprove: (slug: string, decision: RetirementDecision) => void;
}

export default function RetirementRegister({ register, approvals, canApprove, approving, onApprove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!register.length) {
    return (
      <section className="rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-6">
        <p className="text-sm text-slate-400">No retired Edge Functions registered.</p>
      </section>
    );
  }

  const needs = register.filter((r) => r.classification === 'needs_verification');
  const removable = register.filter((r) => r.classification === 'retired_removable');
  const kept = register.filter((r) => r.classification === 'retired_disabled');
  const active = register.filter((r) => r.classification === 'active');

  return (
    <section className="rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
            <i className="ri-shield-check-line text-xl"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Edge Function Retirement Register</h2>
            <p className="text-xs text-slate-400 mt-0.5">Read-only dependency audit of retired candidate functions. No functions are deleted automatically.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <CountChip label="Needs verification" value={needs.length} cls="bg-amber-500/10 text-amber-400" />
          <CountChip label="Safely removable" value={removable.length} cls="bg-emerald-500/10 text-emerald-400" />
          <CountChip label="Kept disabled" value={kept.length} cls="bg-sky-500/10 text-sky-400" />
          <CountChip label="Active" value={active.length} cls="bg-slate-500/10 text-slate-300" />
        </div>
      </div>

      <div className="space-y-3">
        {register.map((r) => {
          const meta = CLASS_META[r.classification] || CLASS_META.active;
          const approved = approvals.filter((a) => a.function_slug === r.slug);
          return (
            <div key={r.slug} className="rounded-xl border border-[#1a2b4a] bg-[#0e1a2e] p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-bold text-white">{r.name}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <code className="block text-[11px] text-slate-500 font-mono mt-1">{r.slug}</code>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-xs">
                    <InfoRow icon="ri-arrow-left-right-line" label="Replacement" value={r.replacement || 'None (debug only)'} />
                    <InfoRow icon="ri-user-search-line" label="Known callers" value={r.knownCallers} />
                    <InfoRow icon="ri-time-line" label="Last invocation" value={r.lastInvocation} />
                    <InfoRow icon="ri-timer-flash-line" label="Cron / webhook" value={r.cronWebhook} />
                  </div>

                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#0B1933]/60 border border-[#1a2b4a] p-2.5">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-red-400">
                      <i className="ri-shield-flash-line text-sm"></i>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{r.securityRisk}</p>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    <span className="text-slate-400 font-semibold">Evidence: </span>{r.evidence}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    Reviewed by {r.reviewer} on {r.reviewDate}
                  </p>
                </div>

                {r.classification === 'needs_verification' && canApprove && (
                  <div className="sm:w-48 flex-shrink-0">
                    <button
                      onClick={() => setSelected(selected === r.slug ? null : r.slug)}
                      className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-git-commit-line text-sm"></i>
                      </div>
                      Approve action
                    </button>

                    {selected === r.slug && (
                      <div className="mt-2 space-y-1.5 rounded-lg border border-[#1a2b4a] bg-[#0B1933] p-2">
                        <p className="text-[10px] text-slate-500 font-semibold px-1">Approval decision</p>
                        {(['delete', 'disable', 'keep'] as RetirementDecision[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => onApprove(r.slug, d)}
                            disabled={approving}
                            className="inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#111d35] text-slate-300 ring-1 ring-[#243a5e] hover:ring-teal-500/40 hover:text-white transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            {approving ? <i className="ri-loader-4-line animate-spin text-xs"></i> : <i className="ri-check-line text-xs"></i>}
                            {DECISION_LABEL[d]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {approved.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#1a2b4a] space-y-1.5">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Approval history</p>
                  {approved.map((a) => (
                    <div key={a.id} className="text-[11px] space-y-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">
                          <span className="font-bold text-white">{DECISION_LABEL[a.decision] || a.decision}</span>
                          {' '}by {a.approved_by || a.approved_by_email || 'Unknown'}
                        </span>
                        <span className="text-slate-600">{new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {a.reason && <p className="text-slate-500 leading-relaxed">Reason: {a.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {approvals.length > 0 && (
        <div className="pt-4 border-t border-[#1a2b4a]">
          <h3 className="text-sm font-bold text-white mb-3">Retirement approval history</h3>
          <div className="space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0e1a2e] border border-[#1a2b4a] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white">{a.function_slug}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20 whitespace-nowrap">
                    {DECISION_LABEL[a.decision] || a.decision}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {a.approved_by || a.approved_by_email || 'Unknown'} · {new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CountChip({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${cls}`}>
      <span className="text-base leading-none">{value}</span>
      {label}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-slate-500 mt-0.5">
        <i className={`${icon} text-xs`}></i>
      </div>
      <div className="min-w-0">
        <span className="text-slate-500 font-semibold">{label}: </span>
        <span className="text-slate-400">{value}</span>
      </div>
    </div>
  );
}