'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GuardVerification } from './types';

interface SiaCheckRecord {
  id: string;
  reason: string | null;
  status: string | null;
  decision: string | null;
  reasons: string[] | null;
  warnings: string[] | null;
  error: string | null;
  sia_found: boolean | null;
  expected_first_name: string | null;
  expected_surname: string | null;
  licence_number: string | null;
  sia_first_name: string | null;
  sia_surname: string | null;
  sia_role: string | null;
  sia_sector: string | null;
  sia_status: string | null;
  sia_expiry: string | null;
  created_at: string;
  checked_at: string | null;
}

const DECISION_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  approve: { label: 'Approve', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30', icon: 'ri-check-double-line' },
  review: { label: 'Review', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/30', icon: 'ri-alert-line' },
  reject: { label: 'Reject', color: 'bg-red-500/10 text-red-400 ring-red-500/30', icon: 'ri-close-circle-line' },
  error: { label: 'Error', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30', icon: 'ri-error-warning-line' },
};

const REASON_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  manual: 'Manual',
  recheck: 'Recheck',
};

function humanize(token: string | null | undefined): string {
  if (!token) return '—';
  const s = String(token).replace(/_/g, ' ').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeValue(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function isInProgress(check: SiaCheckRecord | null | undefined): boolean {
  if (!check) return false;
  if (check.decision) return false;
  const status = (check.status || '').toLowerCase();
  return status === 'pending' || status === 'processing' || status === 'claimed';
}

function decisionBadge(check: SiaCheckRecord | null | undefined) {
  if (!check || (!check.decision && isInProgress(check))) {
    return { label: 'Check in progress', color: 'bg-blue-500/10 text-blue-400 ring-blue-500/30', icon: 'ri-loader-4-line' };
  }
  const raw = (check.decision || '').toLowerCase();
  const key =
    raw === 'approved' ? 'approve' :
    raw === 'rejected' ? 'reject' :
    raw === 'manual_review' || raw === 'needs_review' ? 'review' :
    raw;
  return DECISION_STYLES[key] || { label: check.decision || 'Unknown', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30', icon: 'ri-question-line' };
}

function Chip({ label, tone }: { label: string; tone: 'amber' | 'red' | 'slate' }) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
    red: 'bg-red-500/10 text-red-300 ring-red-500/20',
    slate: 'bg-slate-500/10 text-slate-300 ring-slate-500/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${tones[tone]} whitespace-nowrap`}>
      {humanize(label)}
    </span>
  );
}

function CompareRow({ label, entered, register, mismatch }: { label: string; entered: string; register: string; mismatch?: boolean }) {
  return (
    <div className="grid grid-cols-12 gap-2 py-2 border-b border-[#1a2b4a]/60 last:border-0">
      <div className="col-span-4 text-xs text-slate-500 pt-0.5">{label}</div>
      <div className={`col-span-4 text-sm font-medium ${mismatch ? 'text-amber-300' : 'text-slate-200'} break-words`}>
        {entered || '—'}
      </div>
      <div className={`col-span-4 text-sm font-medium ${mismatch ? 'text-amber-300' : 'text-slate-200'} break-words`}>
        {register || '—'}
      </div>
    </div>
  );
}

export default function SiaRegisterCheckPanel({ guard }: { guard: GuardVerification }) {
  const [checks, setChecks] = useState<SiaCheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChecks = useCallback(async (): Promise<SiaCheckRecord[]> => {
    const { data, error: fetchError } = await supabase
      .from('sia_checks')
      .select('id,reason,status,decision,reasons,warnings,error,sia_found,expected_first_name,expected_surname,licence_number,sia_first_name,sia_surname,sia_role,sia_sector,sia_status,sia_expiry,created_at,checked_at')
      .eq('subject_type', 'guard')
      .eq('subject_id', guard.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      setError(fetchError.message);
      return [];
    }
    const list = (data as SiaCheckRecord[]) || [];
    setChecks(list);
    return list;
  }, [guard.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await loadChecks();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [loadChecks]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setRunning(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setRunning(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const list = await loadChecks();
      const latest = list[0] || null;
      if (!isInProgress(latest) || attempts >= 30) {
        stopPolling();
      }
    }, 10000);
  }, [loadChecks, stopPolling]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleRerun = async () => {
    setError(null);
    setRunning(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sia-check', {
        body: { guard_id: guard.id, sia_licence_number: guard.sia_licence_number },
      });
      if (fnError) throw new Error(fnError.message || 'SIA check call failed');
      if (data?.error) throw new Error(data.error);
      await loadChecks();
      startPolling();
    } catch (err: any) {
      setError(err.message || 'Failed to re-run SIA check');
      setRunning(false);
    }
  };

  const latest = checks[0] || null;
  const badge = decisionBadge(latest);
  const inProgress = isInProgress(latest);

  const enteredFirst = latest?.expected_first_name || '';
  const enteredLast = latest?.expected_surname || '';
  const registerFirst = latest?.sia_first_name || '';
  const registerSurname = latest?.sia_surname || '';

  const firstMismatch = !!enteredFirst && !!registerFirst && normalizeValue(enteredFirst) !== normalizeValue(registerFirst);
  const lastMismatch = !!enteredLast && !!registerSurname && normalizeValue(enteredLast) !== normalizeValue(registerSurname);

  const licenceType = guard.sia_licence_type || (guard.licence_types && guard.licence_types.length > 0 ? guard.licence_types.join(', ') : '');

  return (
    <div className="bg-[#0a1628] border border-[#1a2b4a] rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-file-search-line text-slate-400 text-sm"></i>
          </div>
          <span className="text-sm font-semibold text-slate-200">Register check</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${badge.color} inline-flex items-center gap-1.5`}>
            <div className="w-3 h-3 flex items-center justify-center">
              <i className={`${badge.icon} text-xs ${inProgress ? 'animate-spin' : ''}`}></i>
            </div>
            {badge.label}
          </span>
        </div>
        <button
          onClick={handleRerun}
          disabled={running}
          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-500/10 text-purple-300 rounded-lg text-xs font-semibold hover:bg-purple-500/20 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {running ? (
            <>
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin text-sm"></i>
              </div>
              Check in progress…
            </>
          ) : (
            <>
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-refresh-line text-sm"></i>
              </div>
              Re-run SIA check
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading register checks…</p>
      ) : !latest ? (
        <p className="text-xs text-slate-500">No register checks recorded for this guard yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
            <span>{new Date(latest.created_at).toLocaleString('en-GB')}</span>
            <span className="text-slate-600">·</span>
            <span>{REASON_LABELS[(latest.reason || '').toLowerCase()] || humanize(latest.reason)}</span>
            {latest.sia_found === false && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400">Not found on register</span>
              </>
            )}
          </div>

          <div className="rounded-lg border border-[#1a2b4a] overflow-hidden mb-3">
            <div className="grid grid-cols-12 gap-2 bg-[#111d35] px-3 py-2 border-b border-[#1a2b4a]">
              <div className="col-span-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Field</div>
              <div className="col-span-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Guard entered</div>
              <div className="col-span-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">SIA register shows</div>
            </div>
            <div className="px-3">
              <CompareRow label="First name" entered={enteredFirst} register={registerFirst} mismatch={firstMismatch} />
              <CompareRow label="Last name" entered={enteredLast} register={registerSurname} mismatch={lastMismatch} />
              <CompareRow label="Licence number" entered={latest.licence_number || guard.sia_licence_number || ''} register={latest.licence_number || guard.sia_licence_number || ''} />
              <CompareRow label="Licence type" entered={licenceType} register={latest.sia_sector || ''} />
              <CompareRow label="Sector / Role" entered={''} register={[latest.sia_sector, latest.sia_role].filter(Boolean).join(' · ')} />
              <CompareRow label="Status" entered={''} register={latest.sia_status || ''} />
              <CompareRow label="Expiry" entered={''} register={latest.sia_expiry ? new Date(latest.sia_expiry).toLocaleDateString('en-GB') : ''} />
            </div>
          </div>

          {((latest.reasons && latest.reasons.length > 0) || (latest.warnings && latest.warnings.length > 0) || latest.error) && (
            <div className="space-y-2 mb-3">
              {latest.reasons && latest.reasons.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">Reasons</span>
                  {latest.reasons.map((r, i) => <Chip key={i} label={r} tone="red" />)}
                </div>
              )}
              {latest.warnings && latest.warnings.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">Warnings</span>
                  {latest.warnings.map((w, i) => <Chip key={i} label={w} tone="amber" />)}
                </div>
              )}
              {latest.error && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">Error</span>
                  <Chip label={latest.error} tone="slate" />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Check history</p>
            <div className="space-y-1.5">
              {checks.map((check) => {
                const cb = decisionBadge(check);
                const reasonLabel = REASON_LABELS[(check.reason || '').toLowerCase()] || humanize(check.reason);
                const chips = [...(check.reasons || []), ...(check.warnings || [])];
                return (
                  <div key={check.id} className="flex items-center gap-3 text-xs bg-[#111d35] rounded-lg px-3 py-2">
                    <span className="text-slate-400 w-40 flex-shrink-0" suppressHydrationWarning>
                      {new Date(check.created_at).toLocaleString('en-GB')}
                    </span>
                    <span className="text-slate-300 w-20 flex-shrink-0">{reasonLabel}</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ring-1 ${cb.color} whitespace-nowrap flex-shrink-0`}>
                      {cb.label}
                    </span>
                    <span className="text-slate-500 truncate">
                      {chips.length > 0 ? chips.map((c) => humanize(c)).join(', ') : check.error ? humanize(check.error) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}