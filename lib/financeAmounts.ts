export const collectedStatuses = ['succeeded', 'completed', 'paid', 'refunded', 'partially_refunded'];
export function isCollected(status: string): boolean { return collectedStatuses.includes(status.toLowerCase()); }
export function refundAmount(payment: {amount: unknown; refund_amount?: unknown; refunded?: boolean; status: string}): number {
  const amount = Math.max(0, Number(payment.amount) || 0);
  const recorded = Number(payment.refund_amount);
  if (Number.isFinite(recorded) && recorded > 0) return Math.min(amount, recorded);
  return payment.refunded || payment.status === 'refunded' ? amount : 0;
}
export function paymentAmounts(payment: {amount: unknown; refund_amount?: unknown; refunded?: boolean; status: string}, fee = 0) {
  const collected = isCollected(payment.status) ? Math.max(0, Number(payment.amount) || 0) : 0;
  const refunded = collected ? refundAmount(payment) : 0;
  const remaining = collected - refunded;
  return {collected, refunded, remaining, net: remaining - (collected ? fee : 0)};
}
