'use client';

import { useEffect, useRef, useState } from 'react';
import { requestAdminCleanup, CleanupResponseError, type CleanupPreview, type CleanupReceipt } from '@/lib/adminManualCleanup';

const storageKey = 'quickguard:admin-cleanup-request';
type Phase = 'idle' | 'previewing' | 'ready' | 'running' | 'checking' | 'uncertain' | 'completed' | 'error';
export default function AdminCleanupControl({ onCompleted }: { onCompleted: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [receipt, setReceipt] = useState<CleanupReceipt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedRequest, setSavedRequest] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const scope = useRef({ active: true, busy: false, requestId: null as string | null });

  useEffect(() => {
    const state = scope.current; state.active = true;
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) {
        state.requestId = saved; setSavedRequest(saved); setPhase('uncertain');
        setMessage('A saved cleanup request is available. Check its result before starting another run.');
      }
    } catch { /* Storage is optional; the current request also remains in memory. */ }
    return () => { state.active = false; };
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);

  const remember = (requestId: string | null) => {
    scope.current.requestId = requestId; setSavedRequest(requestId);
    try {
      if (requestId) window.sessionStorage.setItem(storageKey, requestId);
      else window.sessionStorage.removeItem(storageKey);
    } catch { /* A storage restriction must not change the confirmed server outcome. */ }
  };
  const acceptReceipt = (value: CleanupReceipt) => {
    setReceipt(value); setPreview(null); setPhase('completed'); setMessage(null); remember(null);
    Promise.resolve().then(onCompleted).catch(() => {
      if (scope.current.active) setMessage('Cleanup completed. Refresh the inventory to confirm its latest display.');
    });
  };
  const startPreview = async () => {
    if (scope.current.busy || scope.current.requestId) return;
    scope.current.busy = true; setOpen(true); setPhase('previewing'); setMessage(null); setConfirmed(false); setReceipt(null);
    try {
      const result = await requestAdminCleanup('preview');
      if (!scope.current.active) return;
      if (result.status !== 'previewed') throw new Error('Preview unavailable');
      remember(result.request_id); setPreview(result); setPhase('ready');
    } catch {
      if (scope.current.active) { setPhase('error'); setMessage('Unable to prepare cleanup. Check your admin sign-in and MFA, then review again.'); }
    } finally { scope.current.busy = false; }
  };
  const checkResult = async () => {
    const requestId = scope.current.requestId;
    if (scope.current.busy || !requestId) return;
    scope.current.busy = true; setOpen(true); setPhase('checking'); setMessage(null); setConfirmed(false);
    try {
      const result = await requestAdminCleanup('status', requestId);
      if (!scope.current.active) return;
      if (result.status === 'completed') acceptReceipt(result);
      else if (result.status === 'preview_expired') {
        remember(null); setPreview(null); setPhase('error'); setMessage('The preview expired without a completed run. Review a new preview.');
      } else {
        setPreview(result); setPhase('ready'); setMessage('No completed run is recorded. Review this saved preview before confirming the same request.');
      }
    } catch (error: unknown) {
      if (scope.current.active) {
        if (error instanceof CleanupResponseError && error.code === 'NOT_FOUND') {
          remember(null); setPreview(null); setPhase('error');
          setMessage('The saved request is not available to this admin. Review a new preview.');
        } else {
          setPhase('uncertain'); setMessage('The saved request result is unconfirmed. Check again; do not start another cleanup.');
        }
      }
    } finally { scope.current.busy = false; }
  };
  const execute = async () => {
    if (scope.current.busy || !confirmed || !preview || scope.current.requestId !== preview.request_id) return;
    scope.current.busy = true; setPhase('running'); setMessage(null);
    try {
      const result = await requestAdminCleanup('execute', preview.request_id, true);
      if (!scope.current.active) return;
      if (result.status !== 'completed') throw new Error('Completion unconfirmed');
      acceptReceipt(result);
    } catch (error: unknown) {
      if (scope.current.active) {
        if (error instanceof CleanupResponseError && error.code === 'PREVIEW_CHANGED') {
          remember(null); setPreview(null); setPhase('error'); setConfirmed(false);
          setMessage('Eligible records changed or the preview expired. Review a new preview.');
        } else {
          setPhase('uncertain'); setConfirmed(false); setMessage('Cleanup outcome is unconfirmed. Check the saved request result before doing anything else.');
        }
      }
    } finally { scope.current.busy = false; }
  };
  const busy = ['previewing', 'running', 'checking'].includes(phase);
  const eligible = preview?.inventory.targets.reduce((sum, target) => sum + target.eligible_rows, 0) ?? 0;

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={savedRequest ? checkResult : startPreview} disabled={busy}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Checking cleanup…' : savedRequest ? 'Check saved cleanup' : 'Review cleanup'}
      </button>
      {!open && receipt && <p role="status" className="text-xs text-emerald-400">Cleanup completed: {receipt.total_removed} records removed.</p>}
      {!open && savedRequest && <p className="text-xs text-amber-400">A saved cleanup request needs review.</p>}
      {open && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cleanup-review-title"
            onKeyDown={event => {
              if (event.key === 'Escape' && !busy) setOpen(false);
              if (event.key !== 'Tab') return;
              const items = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
              const first = items[0], last = items[items.length - 1];
              if (!first) { event.preventDefault(); return; }
              if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                event.preventDefault(); last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
              }
            }} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 id="cleanup-review-title" className="text-lg font-bold text-white">{phase === 'completed' ? 'Cleanup completed' : 'Review scheduled cleanup'}</h2>
            <p className="text-sm text-slate-400 mt-2">Only the six configured cleanup targets are included. Existing retention and status rules apply. Eligible records are permanently deleted.</p>
            {savedRequest && <p className="text-xs text-slate-500 mt-2">Request: {savedRequest}</p>}
            {message && <p role="alert" className="text-sm text-amber-400 mt-3">{message}</p>}
            {busy && <p role="status" className="text-sm text-slate-300 mt-4">{phase === 'running' ? 'Running the confirmed cleanup request…' : 'Checking cleanup…'}</p>}
            {preview && phase === 'ready' && (
              <>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs text-slate-300">
                    <thead><tr><th className="text-left p-2">Target</th><th className="p-2">Retention</th><th className="p-2">Records</th><th className="p-2">Eligible</th></tr></thead>
                    <tbody>{preview.inventory.targets.map(target => <tr key={target.table_name}>
                      <td className="p-2 font-mono">{target.target_relation}</td><td className="p-2 text-center">{target.retention_days} days</td>
                      <td className="p-2 text-center">{target.total_rows.toLocaleString('en-GB')}</td><td className="p-2 text-center">{target.eligible_rows.toLocaleString('en-GB')}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <p className="text-sm text-white mt-3">{eligible.toLocaleString('en-GB')} records eligible. Preview expires {new Date(preview.expires_at).toLocaleTimeString('en-GB')}. Eligibility is checked again before execution.</p>
                <label className="flex items-start gap-2 text-sm text-slate-300 mt-4">
                  <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
                  I understand that eligible records will be permanently deleted under the existing retention rules.
                </label>
                <button onClick={execute} disabled={!confirmed || busy} className="mt-4 px-4 py-2 rounded-lg bg-red-700 text-white text-sm disabled:opacity-50">Run confirmed cleanup</button>
              </>
            )}
            {phase === 'completed' && receipt && <div role="status" className="mt-4 text-sm text-emerald-400">
              <p>All six routines completed. {receipt.total_removed.toLocaleString('en-GB')} records removed.</p>
              <p className="text-xs mt-2">Audit request: {receipt.request_id}</p>
            </div>}
            {phase === 'uncertain' && <button onClick={checkResult} disabled={busy} className="mt-4 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm">Check saved result</button>}
            {phase === 'error' && !savedRequest && <button onClick={startPreview} className="mt-4 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm">Review again</button>}
            <div className="flex justify-end mt-5"><button onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2 rounded-lg bg-[#1a2b4a] text-slate-300 text-sm disabled:opacity-50">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
