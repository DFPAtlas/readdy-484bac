import { isGuardOnSite } from './attendance-display.cjs';

type TrackerGroup = 'active' | 'completed' | 'cancelled' | 'draft' | 'closed' | 'unknown';
type TrackerTone = 'slate' | 'amber' | 'orange' | 'blue' | 'emerald' | 'red';
interface TrackerLifecycle {
  label: string;
  group: TrackerGroup;
  stage: number | null;
  tone: TrackerTone;
  complete?: boolean;
}

// Matches the deployed app.jobs status constraint. Stages describe booking/work
// progress; a completed work stage does not assert that a payout has settled.
export const TRACKER_LIFECYCLE: Record<string, TrackerLifecycle> = {
  draft: { label: 'Draft', group: 'draft', stage: null, tone: 'slate' },
  pending: { label: 'Pending Review', group: 'active', stage: 1, tone: 'slate' },
  open: { label: 'Posted', group: 'active', stage: 2, tone: 'amber' },
  awaiting_guard_selection: { label: 'Awaiting Guard Selection', group: 'active', stage: 2, tone: 'amber' },
  awaiting_client_confirmation: { label: 'Awaiting Booking Confirmation', group: 'active', stage: 3, tone: 'orange' },
  awaiting_payment: { label: 'Awaiting Payment', group: 'active', stage: 3, tone: 'orange' },
  funded: { label: 'Funded', group: 'active', stage: 4, tone: 'blue' },
  confirmed: { label: 'Confirmed', group: 'active', stage: 4, tone: 'blue' },
  in_progress: { label: 'In Progress', group: 'active', stage: 4, tone: 'blue' },
  awaiting_client_approval: { label: 'Awaiting Completion Approval', group: 'active', stage: 5, tone: 'amber' },
  completed: { label: 'Completed', group: 'completed', stage: 5, complete: true, tone: 'emerald' },
  payout_approved: { label: 'Payout Pending', group: 'completed', stage: 5, complete: true, tone: 'emerald' },
  paid_out: { label: 'Paid Out', group: 'completed', stage: 5, complete: true, tone: 'emerald' },
  review_pending: { label: 'Review Pending', group: 'completed', stage: 5, complete: true, tone: 'emerald' },
  cancelled: { label: 'Cancelled', group: 'cancelled', stage: null, tone: 'red' },
  // Closed can mean an archived booking; do not invent completed work/payment.
  closed: { label: 'Closed', group: 'closed', stage: null, tone: 'slate' },
};

export function trackerLifecycle(status?: string | null): TrackerLifecycle {
  return status && Object.prototype.hasOwnProperty.call(TRACKER_LIFECYCLE, status)
    ? TRACKER_LIFECYCLE[status]
    : { label: 'Status unavailable', group: 'unknown', stage: null, tone: 'slate' };
}

export const TRACKER_FILTER_STATUSES: Record<string, string[]> = Object.fromEntries(
  ['active', 'completed', 'cancelled', 'all'].map(group => [group, group === 'all' ? [] :
    Object.entries(TRACKER_LIFECYCLE).filter(([, value]) => value.group === group).map(([status]) => status)]),
);

export function trackerStepState(status: string, step: number): 'done' | 'active' | 'pending' {
  const lifecycle = trackerLifecycle(status);
  if (lifecycle.stage == null) return 'pending';
  if (lifecycle.complete || step < lifecycle.stage) return 'done';
  return step === lifecycle.stage ? 'active' : 'pending';
}

export function trackerHasLiveAttendance(status?: string | null): boolean {
  return ['funded', 'confirmed', 'in_progress'].includes(status || '');
}

export function trackerAttendance(assignments: any[], status: string) {
  const result = { checkedIn: 0, late: 0, noShow: 0, issues: 0, replacements: 0 };
  if (!trackerHasLiveAttendance(status)) return result;
  for (const assignment of assignments) {
    if (['cancelled', 'completed'].includes(assignment.status)) continue;
    if (isGuardOnSite(assignment)) result.checkedIn++;
    const finished = !!assignment.check_out_time || ['checked_out', 'completed'].includes(assignment.attendance_status);
    if (finished) continue;
    if (assignment.attendance_status === 'late') result.late++;
    if (assignment.attendance_status === 'no_show') result.noShow++;
    if (assignment.issue_reported) result.issues++;
    if (assignment.replacement_requested) result.replacements++;
  }
  return result;
}
