import { paymentDocumentLink } from './payment-document-links';
export { paymentDocumentLink };

export type PaymentDocumentResult = {
  transaction_id: string;
  status: 'checked' | 'not_issued' | 'not_paid' | 'not_linked' | 'needs_review' | 'different_mode' | 'not_found';
  mode: 'live' | 'test' | 'unknown';
  receipt_url: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  checked_at: string;
};
export function paymentDocumentMode(sessionId: unknown): 'live' | 'test' | 'unknown' {
  return typeof sessionId === 'string' && /^cs_test_[A-Za-z0-9]+$/.test(sessionId) ? 'test' : typeof sessionId === 'string' && /^cs_live_[A-Za-z0-9]+$/.test(sessionId) ? 'live' : 'unknown';
}
export async function loadClientPaymentDocuments(db: any, transactionId: string): Promise<PaymentDocumentResult> {
  const before = await db.auth.getUser();
  if (before.error || !before.data?.user) throw new Error('Sign in to check documents');
  const { data, error } = await db.functions.invoke('get-client-payment-documents', { body: { transaction_id: transactionId } });
  const after = await db.auth.getUser();
  if (after.error || after.data?.user?.id !== before.data.user.id) throw new Error('Session changed');
  if (error || !data || data.transaction_id !== transactionId ||
    !['checked', 'not_issued', 'not_paid', 'not_linked', 'needs_review', 'different_mode', 'not_found'].includes(data.status) ||
    !['live', 'test', 'unknown'].includes(data.mode) || typeof data.checked_at !== 'string' || !Number.isFinite(Date.parse(data.checked_at))) throw new Error('Payment document check failed');
  for (const [key, kind] of [['receipt_url', 'receipt'], ['invoice_url', 'invoice'], ['invoice_pdf', 'invoice']] as const) {
    if (data[key] !== null && !paymentDocumentLink(data[key], kind)) throw new Error('Invalid document link');
  }
  if (!['checked', 'not_issued'].includes(data.status) && (data.receipt_url || data.invoice_url || data.invoice_pdf)) throw new Error('Unverified document links');
  return { transaction_id: transactionId, status: data.status, mode: data.mode, receipt_url: data.receipt_url, invoice_url: data.invoice_url, invoice_pdf: data.invoice_pdf, checked_at: data.checked_at };
}
