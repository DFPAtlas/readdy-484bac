export const collectedStatuses = ['succeeded', 'completed', 'paid', 'refunded', 'partially_refunded'];
export interface FinancialPayment { amount: unknown; refund_amount?: unknown; refunded?: boolean; status: string; }
export function isCollected(status: string): boolean { return collectedStatuses.includes(status.toLowerCase()); }
function money(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0; }
export function refundAmount(payment: FinancialPayment): number {
  const amount = money(payment.amount);
  if (payment.status.toLowerCase() === 'refunded' || payment.refunded) return amount / 100;
  return Math.min(amount, money(payment.refund_amount)) / 100;
}
export function paymentAmounts(payment: FinancialPayment, fee = 0) {
  const collectedPence = isCollected(payment.status) ? money(payment.amount) : 0;
  const refundPence = collectedPence ? Math.round(refundAmount(payment) * 100) : 0;
  const remainingPence = collectedPence - refundPence;
  return { collected: collectedPence / 100, refunded: refundPence / 100, remaining: remainingPence / 100,
    net: (remainingPence - (collectedPence ? money(fee) : 0)) / 100 };
}
export function paymentTotals(payments: FinancialPayment[]) {
  const totals = payments.reduce((sum, payment) => {
    const amounts = paymentAmounts(payment);
    sum.collected += Math.round(amounts.collected * 100);
    sum.refunded += Math.round(amounts.refunded * 100);
    sum.remaining += Math.round(amounts.remaining * 100);
    return sum;
  }, {collected: 0, refunded: 0, remaining: 0});
  return { collected: totals.collected / 100, refunded: totals.refunded / 100, remaining: totals.remaining / 100 };
}
