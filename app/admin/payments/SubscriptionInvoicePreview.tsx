'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PreviewState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'preview'; invoiceId: string; amount: number; recorded: boolean };

export default function SubscriptionInvoicePreview({ subscriptionId, currency }: {
  subscriptionId: string | null | undefined;
  currency: string | null | undefined;
}) {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const activeRef = useRef(true);
  const requestRef = useRef(0);
  const runningRef = useRef(false);
  const validId = typeof subscriptionId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId);

  useEffect(() => {
    activeRef.current = true;
    requestRef.current++;
    runningRef.current = false;
    setState({ kind: 'idle' });
    return () => { activeRef.current = false; };
  }, [subscriptionId]);

  const preview = async () => {
    if (!validId || !activeRef.current || runningRef.current) return;
    runningRef.current = true;
    const request = ++requestRef.current;
    const isCurrent = () => activeRef.current && requestRef.current === request;
    setState({ kind: 'loading' });
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Your admin session is unavailable. Sign in again.');
      if (!isCurrent()) return;
      const { data, error } = await supabase.functions.invoke('backfill-subscription-payments', {
        body: { subscription_id: subscriptionId, dry_run: true },
      });
      if (!isCurrent()) return;
      if (error) throw new Error('Invoice preview is unavailable. Check your admin MFA session and try again.');
      const payload: unknown = data;
      if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true
          || !('results' in payload) || !Array.isArray(payload.results) || payload.results.length !== 1) {
        throw new Error('Invoice preview was not confirmed. Review the subscription’s Stripe environment and invoice evidence.');
      }
      const result: unknown = payload.results[0];
      if (!result || typeof result !== 'object' || !('sub_id' in result) || result.sub_id !== subscriptionId
          || !('action' in result)) throw new Error('Invoice preview did not match this subscription.');
      if (result.action === 'skipped' && 'reason' in result && typeof result.reason === 'string' && result.reason.trim()) {
        setState({ kind: 'skipped', reason: result.reason });
      } else if (result.action === 'preview' && 'invoice_id' in result && typeof result.invoice_id === 'string'
          && result.invoice_id.trim() && 'amount' in result && typeof result.amount === 'number'
          && Number.isFinite(result.amount) && result.amount >= 0
          && 'already_recorded' in result && typeof result.already_recorded === 'boolean') {
        setState({ kind: 'preview', invoiceId: result.invoice_id, amount: result.amount, recorded: result.already_recorded });
      } else throw new Error('Invoice preview returned an unexpected result.');
    } catch (error: unknown) {
      if (isCurrent()) setState({ kind: 'error', message: error instanceof Error ? error.message : 'Invoice preview failed. Try again.' });
    } finally {
      if (isCurrent()) runningRef.current = false;
    }
  };

  return (
    <section className="rounded-xl border border-[#1a2b4a] p-4 space-y-3" aria-label="Subscription invoice preview">
      <h3 className="text-sm font-semibold text-white">Latest subscription invoice</h3>
      <p className="text-xs text-slate-400">Read-only preview for this subscription. Checks its latest invoice, which may differ from this payment. No payment records are changed.</p>
      <button onClick={preview} disabled={!validId || state.kind === 'loading'}
        className="w-full rounded-xl border border-teal-500/40 px-4 py-2 text-sm font-medium text-teal-300 disabled:opacity-50">
        {state.kind === 'loading' ? 'Previewing invoice...' : state.kind === 'error' ? 'Retry invoice preview' : 'Preview latest invoice'}
      </button>
      {!validId && <p className="text-sm text-amber-300">This payment has no valid subscription link to preview.</p>}
      {state.kind === 'loading' && <p role="status" className="text-sm text-slate-300">Checking the latest invoice...</p>}
      {state.kind === 'error' && <p role="alert" className="text-sm text-amber-300">{state.message}</p>}
      {state.kind === 'skipped' && <p role="status" className="text-sm text-amber-300">No paid invoice preview: {state.reason}. No records changed.</p>}
      {state.kind === 'preview' && (
        <div role="status" className="text-sm text-slate-300 space-y-1">
          <p className="break-all">Invoice: {state.invoiceId}</p>
          <p>Paid amount: {state.amount.toFixed(2)} {typeof currency === 'string' && /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : '(currency not recorded)'}</p>
          <p>{state.recorded ? 'Already recorded in payment history.' : state.amount === 0 ? 'Zero-value invoice; no payment record is required.' : 'Missing from payment history; reconciliation is required to record it.'}</p>
          <p>No records changed.</p>
        </div>
      )}
    </section>
  );
}
