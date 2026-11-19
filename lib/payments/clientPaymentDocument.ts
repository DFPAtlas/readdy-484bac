import type { supabase } from '../supabase';

export interface RecordedClientPayment {
  id: string;
  client_id: string;
  job_id: string;
  amount: number | string;
  currency?: string | null;
  status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  processed_at?: string | null;
  payment_method?: string | null;
  gateway_name?: string | null;
  refunded?: boolean | null;
  refund_amount?: number | string | null;
  refunded_at?: string | null;
}

export interface PaymentDocumentClient {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
}

export interface PaymentDocumentJob {
  id: string;
  job_title?: string | null;
}

export interface ClientPaymentDocument {
  title: 'Payment record' | 'Payment estimate';
  reference: string;
  client: PaymentDocumentClient;
  job: PaymentDocumentJob;
  details: Array<{ label: string; value: string }>;
  amounts: Array<{ label: string; value: string }>;
  note: string;
}

function moneyValue(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    throw new Error('The recorded payment amount is unavailable.');
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('The recorded payment amount is invalid.');
  return amount;
}

function formatMoney(amount: number, currency?: string | null): string {
  // Legacy QuickGuard transactions without a currency were created in GBP.
  const code = currency?.trim().toUpperCase() || 'GBP';
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('The recorded payment currency is invalid.');
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(amount);
}

function recordedDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London', timeZoneName: 'short',
  }).format(new Date(value));
}

/** A historical record must never be repriced from a mutable job or today's fee rules. */
export function buildClientPaymentRecord(
  payment: RecordedClientPayment, client: PaymentDocumentClient, job: PaymentDocumentJob,
): ClientPaymentDocument {
  if (!payment.id || !client.id || !job.id || payment.client_id !== client.id || payment.job_id !== job.id) {
    throw new Error('The payment does not belong to this client and job.');
  }
  const amount = moneyValue(payment.amount);
  const refund = payment.refund_amount == null ? null : moneyValue(payment.refund_amount);
  if (refund !== null && refund > amount) throw new Error('The recorded refund exceeds the payment amount.');
  const statuses = [payment.status, payment.payment_status].map(value => value?.toLowerCase());
  const has = (...values: string[]) => statuses.some(value => value && values.includes(value));
  const refunded = payment.refunded || has('refunded');
  const paid = has('paid', 'completed', 'succeeded');
  const status = has('disputed') ? 'Disputed'
    : refunded || (refund !== null && refund > 0 && refund === amount) ? 'Refunded'
    : (refund !== null && refund > 0) || has('partially_refunded') ? 'Partially refunded'
    : has('failed') ? 'Failed'
    : has('cancelled', 'canceled') ? 'Cancelled'
    : paid ? 'Paid'
    : has('pending', 'processing', 'invoice_sent', 'awaiting_payment') ? 'Pending'
    : 'Status not recorded';
  const details = [
    { label: 'Status', value: status },
    { label: 'Transaction created', value: recordedDate(payment.created_at) },
    { label: 'Payment method', value: payment.payment_method || payment.gateway_name || 'Not recorded' },
  ];
  if (paid || refunded || status === 'Partially refunded' || payment.completed_at || payment.processed_at) {
    details.push({ label: 'Payment date', value: recordedDate(payment.completed_at || payment.processed_at) });
  }
  const amounts = [{ label: 'Recorded transaction amount', value: formatMoney(amount, payment.currency) }];
  if (refunded || status === 'Partially refunded' || (refund !== null && refund > 0)) {
    amounts.push({ label: 'Refunded amount', value: refund === null ? 'Not recorded' : formatMoney(refund, payment.currency) });
    details.push({ label: 'Refund date', value: recordedDate(payment.refunded_at) });
  }
  return {
    title: 'Payment record', reference: payment.id, client, job, details, amounts,
    note: 'This record shows the saved transaction and any recorded refund. No additional tax or payment is requested. It is not a VAT invoice.',
  };
}

export function buildClientPaymentEstimate(
  client: PaymentDocumentClient, job: PaymentDocumentJob,
  costs: { guardFees: number; serviceFee: number; vat: number; processingFee?: number; total: number },
): ClientPaymentDocument {
  const amounts = [
    { label: 'Estimated guard fees', value: formatMoney(moneyValue(costs.guardFees)) },
    { label: 'Estimated service fee', value: formatMoney(moneyValue(costs.serviceFee)) },
  ];
  if (costs.processingFee) amounts.push({ label: 'Estimated processing fee', value: formatMoney(moneyValue(costs.processingFee)) });
  if (costs.vat) amounts.push({ label: 'Estimated tax', value: formatMoney(moneyValue(costs.vat)) });
  amounts.push({ label: 'Estimated total', value: formatMoney(moneyValue(costs.total)) });
  return {
    title: 'Payment estimate', reference: job.id, client, job,
    details: [{ label: 'Status', value: 'Estimate — no payment recorded' }], amounts,
    note: 'This is an estimate, not an invoice or proof of payment. Confirm the final amount through QuickGuard checkout.',
  };
}

/** Read only the signed-in client's transaction; no private guard joins are needed. */
export async function loadClientPaymentRecord(database: Pick<typeof supabase, 'auth' | 'from'>, transactionId: string): Promise<ClientPaymentDocument> {
  if (!transactionId) throw new Error('Select a payment to view its record.');
  const auth = await database.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error('Please sign in again to view the payment record.');
  const clientResult = await database.from('clients').select('id, company_name, contact_name, email')
    .eq('user_id', auth.data.user.id).maybeSingle();
  if (clientResult.error || !clientResult.data) throw new Error('The client account could not be loaded.');
  const client = clientResult.data as PaymentDocumentClient;
  const paymentResult = await database.from('transactions').select('*')
    .eq('id', transactionId).eq('client_id', client.id).maybeSingle();
  if (paymentResult.error || !paymentResult.data) throw new Error('The payment record is unavailable. Please try again.');
  const payment = paymentResult.data as RecordedClientPayment;
  const jobResult = await database.from('jobs').select('id, job_title')
    .eq('id', payment.job_id).eq('client_id', client.id).maybeSingle();
  if (jobResult.error || !jobResult.data) throw new Error('The job for this payment could not be loaded.');
  const currentAuth = await database.auth.getUser();
  if (currentAuth.error || currentAuth.data.user?.id !== auth.data.user.id) {
    throw new Error('Your sign-in changed. Please reopen the payment record.');
  }
  return buildClientPaymentRecord(payment, client, jobResult.data);
}

/** Input is the React-rendered document DOM, never unescaped database values. */
export function paymentDocumentHTML(renderedDocument: string): string {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QuickGuard payment document</title></head><body>'
    + renderedDocument + '</body></html>';
}
