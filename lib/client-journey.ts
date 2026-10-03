export const bookingLabels: Record<string, string> = {
 draft: 'Draft', pending: 'Pending', open: 'Posted', awaiting_guard_selection: 'Applications',
 awaiting_payment: 'Awaiting Payment', payment_pending: 'Awaiting Payment', confirmed: 'Confirmed',
 awaiting_client_confirmation: 'Awaiting Confirmation', in_progress: 'Active', active: 'Active',
 completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed', closed: 'Closed',
 awaiting_client_approval: 'Awaiting Completion Approval', payout_approved: 'Payout Pending', paid_out: 'Paid Out', review_pending: 'Review Pending'
};
export function paymentLabel(status?: string | null): string {
 const labels: Record<string, string> = { completed: 'Paid', succeeded: 'Paid', paid: 'Paid', funded: 'Paid', released: 'Paid',
 pending: 'Pending', pending_payment: 'Pending', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partially refunded', none: 'No Payment' };
 return labels[status || 'none'] || (status || 'No Payment').replaceAll('_', ' ');
}
export interface JourneyJob { id: string; status: string; payment_status?: string | null; applications_count?: number; assigned_count?: number; needs_review?: boolean; refund_status?: string | null; cancellation_status?: string | null; }
export function nextJobAction(job: JourneyJob) {
 const id = encodeURIComponent(job.id);
 const detail = `/client/jobs/detail?id=${id}`;
 if (job.status === 'cancelled' || job.payment_status === 'refunded' || job.refund_status || job.cancellation_status === 'requested') {
  return {label: job.refund_status || ['refunded','partially_refunded'].includes(job.payment_status || '') ? 'Track Refund' : 'View Booking', href: job.refund_status || ['refunded','partially_refunded'].includes(job.payment_status || '') ? `/client/payment-centre?tab=history&job=${id}` : detail, attention: false};
 }
 if (['awaiting_payment','payment_pending'].includes(job.status) && !['funded','paid','completed','succeeded','refunded','partially_refunded','released'].includes(job.payment_status || ''))
  return {label:'Pay to Confirm',href:`/client/jobs/payment?id=${id}`,attention:true};
 if (['open','pending','awaiting_guard_selection'].includes(job.status) && (job.applications_count || 0) > 0)
  return {label:'Review Applicants',href:`/client/jobs/applicants?id=${id}`,attention:true};
 if (job.status === 'awaiting_client_confirmation') return {label:'Confirm Booking',href:`/client/jobs/confirmation?id=${id}`,attention:true};
 if (job.status === 'awaiting_client_approval') return {label:'Review Completion',href:detail,attention:true};
 if (job.needs_review) return {label:'Leave Review',href:detail,attention:true};
 return {label:'View Booking',href:detail,attention:false};
}
export function planLabel(plan?: string | null) {
 const key = (plan || 'free').toLowerCase().replace(/^client[-_]/,'');
 return ({basic:'Free Starter',free:'Free Starter',starter:'Client Starter',pro:'Client Pro',enterprise:'Client Enterprise'} as Record<string,string>)[key] || plan || 'Free Starter';
}
