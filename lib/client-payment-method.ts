export type ClientPaymentMethodResult = {
  status: 'saved' | 'none' | 'unverified';
  billing_link: 'matched' | 'not_linked' | 'needs_review';
  checked_at: string;
};
export type ClientPaymentMethodState =
  | { status: 'loading' | 'error' }
  | { status: 'checked'; result: ClientPaymentMethodResult };

export async function loadClientPaymentMethod(db: { functions: { invoke: (name: string, options: { body: Record<string, never> }) => Promise<{ data: unknown; error: unknown }> } }): Promise<ClientPaymentMethodResult> {
  const { data, error } = await db.functions.invoke('get-client-payment-method-status', { body: {} });
  if (error || !data || typeof data !== 'object') throw new Error('Payment method check failed');
  const value = data as Partial<ClientPaymentMethodResult>;
  if (!['saved', 'none', 'unverified'].includes(value.status || '') ||
    !['matched', 'not_linked', 'needs_review'].includes(value.billing_link || '') ||
    typeof value.checked_at !== 'string' || !Number.isFinite(Date.parse(value.checked_at)) ||
    (value.status === 'unverified' && value.billing_link !== 'needs_review')) throw new Error('Invalid payment method status');
  return { status: value.status!, billing_link: value.billing_link!, checked_at: value.checked_at };
}

export function paymentMethodView(state: ClientPaymentMethodState) {
  const result = state.status === 'checked' ? state.result : null;
  const needsReview = result?.billing_link === 'needs_review';
  const complete = result?.status === 'saved' && !needsReview;
  const label = !result ? state.status === 'loading' ? 'Checking payment method…' : 'Payment method status unavailable'
    : result.status === 'saved' ? 'Saved payment method' : result.status === 'none' ? 'No saved payment method' : 'Payment method not verified';
  return { label, complete, needsReview, canOpenPortal: !!result && !needsReview && result.status !== 'unverified',
    badge: !result ? state.status === 'loading' ? 'Checking' : 'Unavailable' : needsReview ? 'Billing link needs checking' : result.status === 'saved' ? 'Saved' : 'Not added' };
}
