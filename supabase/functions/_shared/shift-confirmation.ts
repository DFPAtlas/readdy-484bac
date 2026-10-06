// Guard shift confirmation (finding 6).
// A guard confirms a booked shift by stamping job_assignments.guard_confirmed_at —
// the field the client booking screens read. Only the assigned guard may confirm,
// only a confirmed + funded booking on an active job can be confirmed, and success
// is reported only after the write is persisted (error-checked, one row affected).

export class ShiftConfirmationError extends Error {
  constructor(public status: number, message: string, public code: string) { super(message); }
}

const FUNDED = ['funded'];
const ACTIVE_JOB = ['confirmed', 'in_progress'];

export interface ConfirmShiftInput { guardId: string; assignmentId: string; jobId: string; now?: string }

export async function confirmGuardShift(db: any, input: ConfirmShiftInput) {
  const now = input.now || new Date().toISOString();
  const { data: assignment, error: assignmentError } = await db.from('job_assignments')
    .select('id, job_id, guard_id, status, payment_status, guard_confirmed_at')
    .eq('id', input.assignmentId).eq('guard_id', input.guardId).maybeSingle();
  if (assignmentError) throw new ShiftConfirmationError(500, 'Unable to load this shift', 'load_failed');
  if (!assignment) throw new ShiftConfirmationError(404, 'Shift not found or does not belong to you', 'not_found');
  if (assignment.job_id !== input.jobId) throw new ShiftConfirmationError(400, 'Shift does not match this job', 'job_mismatch');
  if (assignment.guard_confirmed_at) {
    return { success: true, alreadyConfirmed: true, guard_confirmed_at: assignment.guard_confirmed_at };
  }
  if (assignment.status !== 'confirmed') throw new ShiftConfirmationError(409, 'This shift is not booked yet', 'not_booked');
  if (!FUNDED.includes(assignment.payment_status || '')) throw new ShiftConfirmationError(409, 'This shift has not been funded yet', 'not_funded');

  const { data: job, error: jobError } = await db.from('jobs')
    .select('id, status, payment_status, is_deleted').eq('id', input.jobId).maybeSingle();
  if (jobError) throw new ShiftConfirmationError(500, 'Unable to load this job', 'load_failed');
  if (!job || job.is_deleted) throw new ShiftConfirmationError(404, 'Job not found', 'job_not_found');
  if (!ACTIVE_JOB.includes(job.status) || !FUNDED.includes(job.payment_status || '')) {
    throw new ShiftConfirmationError(409, 'This job is not active', 'job_inactive');
  }

  // Compare-and-set: only an unconfirmed, still-booked, still-funded row is stamped.
  const { data: updated, error: updateError } = await db.from('job_assignments')
    .update({ guard_confirmed_at: now, updated_at: now })
    .eq('id', input.assignmentId).eq('guard_id', input.guardId)
    .eq('status', 'confirmed').eq('payment_status', 'funded')
    .is('guard_confirmed_at', null)
    .select('id, guard_confirmed_at');
  if (updateError) throw new ShiftConfirmationError(500, 'Failed to confirm shift', 'write_failed');
  if (!Array.isArray(updated) || updated.length !== 1) {
    throw new ShiftConfirmationError(409, 'This shift changed while confirming. Please refresh and try again.', 'conflict');
  }
  return { success: true, alreadyConfirmed: false, guard_confirmed_at: updated[0].guard_confirmed_at || now };
}
