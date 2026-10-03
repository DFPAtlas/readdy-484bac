export const adminJobStatuses: Record<string, string> = {
 draft: 'Draft', pending: 'Pending', open: 'Open', paused: 'Paused',
 awaiting_guard_selection: 'Awaiting selection', awaiting_payment: 'Awaiting payment',
 funded: 'Funded', awaiting_client_approval: 'Awaiting client approval', awaiting_client_confirmation: 'Awaiting client confirmation', confirmed: 'Confirmed', assigned: 'Assigned', active: 'Active', in_progress: 'In progress',
 completion_requested: 'Completion requested', payout_approved: 'Payout approved', paid_out: 'Paid out',
 completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired',
 review_pending: 'Review pending', review_submitted: 'Review submitted', closed: 'Closed',
};
export function adminJobStatusLabel(status: string): string { return adminJobStatuses[status] ?? `Unknown (${status || 'unset'})`; }
export function adminJobStatusBadge(status: string) {
 const color = ['cancelled', 'expired'].includes(status) ? 'rose' : ['confirmed','assigned','active','in_progress','payout_approved'].includes(status) ? 'sky' : 'slate';
 const styles = { rose: {bg: 'bg-rose-500/10', text: 'text-rose-300', ring: 'ring-rose-500/20'}, sky: {bg: 'bg-sky-500/10',text: 'text-sky-300',ring: 'ring-sky-500/20'}, slate: {bg: 'bg-slate-500/10',text: 'text-slate-300',ring: 'ring-slate-500/20'} };
 return {...styles[color as keyof typeof styles], label: adminJobStatusLabel(status), icon: 'ri-briefcase-line'};
}
