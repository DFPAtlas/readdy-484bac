import { isCollected } from './financeAmounts';
import { isCompletedClientJobStatus } from './client-job-completion';

interface TimelinePayment {
  paymentStatus: string;
  releaseStatus: string;
  jobStatus: string;
  refundStatus: string;
}

export function clientPaymentTimeline(payment: TimelinePayment) {
  const collected = isCollected(payment.paymentStatus);
  // The webhook sets job.payment_status=paid_out only after every payable
  // assignment has been paid. Job status (including closed) is not payout proof.
  const transferred = collected && payment.releaseStatus === 'paid_out';
  const released = collected && (transferred || payment.releaseStatus === 'released');
  const held = collected && (released || ['funded', 'paid', 'completed', 'payout_pending', 'payout_processing', 'client_released'].includes(payment.releaseStatus));
  const steps = [
    { label: 'Job Posted', done: true, icon: 'ri-file-list-3-line' },
    { label: 'Guard Selected', done: collected, icon: 'ri-user-star-line' },
    { label: 'Client Paid', done: collected, icon: 'ri-money-pound-circle-line' },
    { label: 'Funds Held', done: held, icon: 'ri-safe-line' },
    { label: 'Guard Completed', done: released || isCompletedClientJobStatus(payment.jobStatus), icon: 'ri-check-double-line' },
    { label: 'Funds Released', done: released, icon: 'ri-send-plane-line' },
    { label: 'Transfer Paid', done: transferred, icon: 'ri-bank-card-line' },
  ];
  if (payment.refundStatus !== '—') steps.push({ label: payment.refundStatus, done: ['refunded', 'partially_refunded'].includes(payment.paymentStatus), icon: 'ri-refund-line' });
  return steps;
}
