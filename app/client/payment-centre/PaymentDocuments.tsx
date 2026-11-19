'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { loadClientPaymentDocuments, paymentDocumentLink, PaymentDocumentResult } from '@/lib/client-payment-documents';

type Payment = { id: string; receiptUrl: string | null; invoiceUrl: string | null; documentMode: 'live' | 'test' | 'unknown' };
export type DocumentState = { status: 'idle' | 'loading' | 'error' | 'blocked' } | { status: 'checked'; result: PaymentDocumentResult };

export function PaymentDocumentsView({ payment, state, onCheck }: { payment: Payment; state: DocumentState; onCheck: () => void }) {
  const result = state.status === 'checked' ? state.result : null;
  // A mode mismatch cannot refresh historical sandbox links with a live key.
  // Keep their explicitly saved/test-labelled links, never call them fresh.
  const useSaved = !result || result.status === 'different_mode';
  const receipt = state.status === 'blocked' ? null : paymentDocumentLink(useSaved ? payment.receiptUrl : result?.receipt_url, 'receipt');
  const invoice = state.status === 'blocked' ? null : paymentDocumentLink(useSaved ? payment.invoiceUrl : result?.invoice_url, 'invoice');
  const pdf = state.status === 'blocked' ? null : paymentDocumentLink(result?.invoice_pdf, 'invoice');
  const mode = result?.mode === 'unknown' || !result ? payment.documentMode : result.mode;
  const explanation = state.status === 'blocked' ? 'Sign in again to load your payment documents.'
    : state.status === 'error' ? 'Documents could not be checked. Please retry.'
    : state.status === 'loading' ? 'Checking payment documents…'
    : result?.status === 'different_mode' ? 'Latest documents cannot be checked in the current payment mode. Saved links may expire.'
    : result?.status === 'needs_review' ? 'Payment link needs checking. Contact support.'
    : result?.status === 'not_found' ? 'Payment not found with the current provider configuration. Contact support.'
    : result?.status === 'not_linked' ? 'No provider payment reference is recorded. Contact support.'
    : result?.status === 'not_paid' ? 'Provider documents are available after a successful payment.' : null;
  return <div className="space-y-2 max-w-sm text-xs">
    {mode === 'test' && <p className="text-amber-300 font-medium">Test payment — not a live charge</p>}
    <div className="flex flex-wrap gap-3">
      {receipt ? <a href={receipt} target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">{useSaved ? 'Saved ' : ''}{mode === 'test' ? 'test receipt' : 'receipt'}</a> : <span className="text-slate-400">{result ? 'Receipt unavailable' : 'No saved receipt'}</span>}
      {invoice && <a href={invoice} target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">{useSaved ? 'Saved ' : ''}Stripe invoice</a>}
      {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">Invoice PDF</a>}
      {!invoice && !pdf && <span className="text-slate-400">{result?.status === 'not_issued' ? 'No Stripe invoice issued' : result?.status === 'checked' ? 'Invoice link unavailable' : 'No saved invoice'}</span>}
    </div>
    {explanation && <p role={state.status === 'error' ? 'alert' : 'status'} className="text-slate-300">{explanation}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={onCheck} disabled={state.status === 'loading' || state.status === 'blocked'} className="text-teal-400 underline disabled:opacity-50" aria-label={`${state.status === 'error' ? 'Retry' : 'Check'} documents for payment ${payment.id}`}>
        {state.status === 'loading' ? 'Checking…' : state.status === 'error' ? 'Retry document check' : 'Check latest documents'}
      </button>
      {result && ['needs_review', 'not_found', 'not_linked'].includes(result.status) && <Link href="/client/support" className="text-teal-400 underline">Contact support</Link>}
    </div>
  </div>;
}

export default function PaymentDocuments({ payment }: { payment: Payment }) {
  const [state, setState] = useState<DocumentState>({ status: 'idle' });
  const mounted = useRef(false);
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    mounted.current = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { request.current++; setState({ status: 'blocked' }); }
    });
    return () => { mounted.current = false; invalidate(); subscription.unsubscribe(); };
  }, [invalidate]);
  const check = async () => {
    const current = ++request.current;
    setState({ status: 'loading' });
    try {
      const result = await loadClientPaymentDocuments(supabase, payment.id);
      if (mounted.current && request.current === current) setState({ status: 'checked', result });
    } catch {
      if (mounted.current && request.current === current) setState({ status: 'error' });
    }
  };
  return <PaymentDocumentsView payment={payment} state={state} onCheck={check} />;
}
