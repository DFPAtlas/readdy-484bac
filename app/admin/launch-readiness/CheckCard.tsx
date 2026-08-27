'use client';

import type { CheckStatus, LaunchCheck } from './types';

const STATUS_META: Record<CheckStatus, { label: string; cls: string; icon: string }> = {
  pass: { label: 'Pass', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', icon: 'ri-check-line' },
  fail: { label: 'Fail', cls: 'bg-red-500/10 text-red-400 ring-red-500/20', icon: 'ri-close-line' },
  warning: { label: 'Warning', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', icon: 'ri-alert-line' },
  not_verified: { label: 'Not verified', cls: 'bg-[#1a2b4a] text-slate-400 ring-[#243a5e]', icon: 'ri-time-line' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  check: LaunchCheck;
  adminName: string;
  rechecking: boolean;
  onRecheck: (id: string) => void;
  onUpdate: (id: string, patch: Partial<LaunchCheck>) => void;
  onSignOff: (id: string) => void;
  signingOff: boolean;
}

export default function CheckCard({ check, adminName, rechecking, onRecheck, onUpdate, onSignOff, signingOff }: Props) {
  const meta = STATUS_META[check.status];

  return (
    <div className="bg-[#111d35] rounded-2xl p-5 border border-[#1a2b4a] shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${meta.cls}`}>
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={`${meta.icon} text-xs`}></i>
              </div>
              {meta.label}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
              check.category === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-sky-500/10 text-sky-300'
            }`}>
              {check.category === 'critical' ? 'Critical' : 'Non-blocking'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-[#1a2b4a] text-slate-500">
              {check.method === 'auto' ? 'Automated' : 'Manual'}
            </span>
          </div>

          <h3 className="text-base font-bold text-white mt-2.5">{check.label}</h3>

          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-time-line"></i>
            </div>
            Last checked {timeAgo(check.lastChecked)}
          </div>

          <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
            {check.evidence ? check.evidence : check.notes}
          </p>

          {check.instruction && (
            <div className="mt-3 rounded-xl bg-[#0e1a2e] border border-[#1a2b4a] p-3">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-information-line"></i>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">Manual verification required</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{check.instruction}</p>
            </div>
          )}

          {check.method === 'manual' && (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Mark status</p>
                <div className="flex flex-wrap gap-2">
                  {(['pass', 'fail', 'not_verified'] as CheckStatus[]).map((s) => {
                    const m = STATUS_META[s];
                    const active = check.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => onUpdate(check.id, { status: s, verifiedBy: s !== 'not_verified' ? (check.verifiedBy || adminName) : '', signedOffBy: '', signedOffAt: null })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ring-1 ${
                          active ? m.cls : 'text-slate-500 ring-[#243a5e] hover:text-slate-300'
                        }`}
                      >
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className={`${m.icon} text-xs`}></i>
                        </div>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Verified by</label>
                  <input
                    type="text"
                    value={check.verifiedBy}
                    onChange={(e) => onUpdate(check.id, { verifiedBy: e.target.value })}
                    placeholder={adminName || 'Your name'}
                    className="w-full bg-[#0e1a2e] border border-[#1a2b4a] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Evidence / reference</label>
                  <input
                    type="text"
                    value={check.evidence}
                    onChange={(e) => onUpdate(check.id, { evidence: e.target.value })}
                    placeholder="Optional note or reference"
                    className="w-full bg-[#0e1a2e] border border-[#1a2b4a] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1a2b4a]">
                <div className="text-xs min-w-0">
                  {check.signedOffBy ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-shield-check-line"></i>
                      </div>
                      <span className="truncate">
                        Signed off by <span className="font-semibold">{check.signedOffBy}</span>
                        {check.signedOffAt ? ` · ${new Date(check.signedOffAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-information-line"></i>
                      </div>
                      Not yet signed off
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onSignOff(check.id)}
                  disabled={signingOff}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  <div className={`w-3 h-3 flex items-center justify-center ${signingOff ? 'animate-spin' : ''}`}>
                    <i className="ri-shield-check-line"></i>
                  </div>
                  {signingOff ? 'Signing off...' : 'Sign off & save'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex sm:flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onRecheck(check.id)}
            disabled={rechecking}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <div className={`w-4 h-4 flex items-center justify-center ${rechecking ? 'animate-spin' : ''}`}>
              <i className="ri-refresh-line text-sm"></i>
            </div>
            Recheck
          </button>
        </div>
      </div>
    </div>
  );
}