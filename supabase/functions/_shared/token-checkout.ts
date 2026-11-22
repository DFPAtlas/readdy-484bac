interface TokenReservation {
  id: string; user_id: string; tokens_used: number; credit_pence: number;
  stripe_checkout_session_id: string | null; stripe_coupon_id: string | null; created_at: string;
}
interface TokenDb { rpc(name: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }
export interface TokenSession {
  id: string; url: string | null; status: string | null; payment_status: string;
  client_reference_id: string | null; mode: string | null;
  metadata: Record<string, string> | null;
  total_details: { amount_discount: number } | null;
}
export function tokenRequest(body: Record<string, unknown>): { tokens: number; requestId: string } | null {
  if (body.tokensToRedeem == null || body.tokensToRedeem === 0) return null;
  if (!Number.isSafeInteger(body.tokensToRedeem) || Number(body.tokensToRedeem) <= 0 || Number(body.tokensToRedeem) > 2147483647
    || typeof body.tokenCheckoutRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.tokenCheckoutRequestId)) throw new Error('Invalid token checkout request.');
  return { tokens: Number(body.tokensToRedeem), requestId: body.tokenCheckoutRequestId };
}
export async function reserveTokenCheckout(db: TokenDb, userId: string, plan: string, cycle: string, request: { tokens: number; requestId: string }): Promise<TokenReservation> {
  const { data, error } = await db.rpc('reserve_qg_token_checkout', { p_user_id: userId, p_request_id: request.requestId, p_plan_slug: plan, p_billing_cycle: cycle, p_tokens: request.tokens });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || !('id' in data) || !('credit_pence' in data) || !('created_at' in data)
    || typeof data.id !== 'string' || !Number.isSafeInteger(data.credit_pence) || Number(data.credit_pence) <= 0 || typeof data.created_at !== 'string' || !Number.isFinite(Date.parse(data.created_at))) throw new Error('Token reservation was not confirmed.');
  // Validate the complete shape before crossing the provider boundary.
  if (!('user_id' in data) || data.user_id !== userId || !('tokens_used' in data) || data.tokens_used !== request.tokens
    || !('stripe_checkout_session_id' in data) || !(data.stripe_checkout_session_id === null || typeof data.stripe_checkout_session_id === 'string')
    || !('stripe_coupon_id' in data) || !(data.stripe_coupon_id === null || typeof data.stripe_coupon_id === 'string')) throw new Error('Token reservation mismatch.');
  return { id: data.id, user_id: userId, tokens_used: request.tokens, credit_pence: Number(data.credit_pence), created_at: data.created_at, stripe_checkout_session_id: data.stripe_checkout_session_id, stripe_coupon_id: data.stripe_coupon_id };
}
export async function finishTokenCheckout(db: TokenDb, session: TokenSession): Promise<void> {
  const id = session.metadata?.qg_token_redemption_id;
  if (!id) return;
  const owner = session.client_reference_id;
  const coupon = session.metadata?.qg_token_coupon_id;
  const credit = Number(session.metadata?.qg_token_credit_pence);
  const paid = session.status === 'complete' && session.payment_status === 'paid';
  const expired = session.status === 'expired' && session.payment_status !== 'paid';
  if (!owner || session.mode !== 'subscription' || !coupon || !Number.isSafeInteger(credit) || credit <= 0) throw new Error('Token payment metadata mismatch.');
  if (!paid && !expired) return; // An async payment still in flight retains its reservation.
  if (paid && session.total_details?.amount_discount !== credit) throw new Error('Token invoice discount mismatch.');
  const { error } = await db.rpc('finish_qg_token_checkout', { p_id: id, p_user_id: owner, p_session_id: session.id, p_coupon_id: coupon,
    p_discount_pence: credit, p_paid: paid, p_expired: expired });
  if (error) throw new Error(error.message);
}
