export type BookingConfirmationState = 'confirmed' | 'reconciling' | 'awaiting_payment';

export interface JobState {
  status?: string | null;
  payment_status?: string | null;
}

export interface AssignmentState {
  status?: string | null;
  payment_status?: string | null;
}

const CONFIRMED_JOB_STATUSES = ['confirmed', 'in_progress', 'completed', 'funded'];
const CONFIRMED_ASSIGNMENT_STATUSES = ['confirmed', 'in_progress', 'completed'];

export function isJobConfirmed(job: JobState): boolean {
  return CONFIRMED_JOB_STATUSES.includes(job.status ?? '');
}

export function isJobFunded(job: JobState): boolean {
  return job.payment_status === 'funded';
}

export function isAssignmentConfirmed(a: AssignmentState): boolean {
  return CONFIRMED_ASSIGNMENT_STATUSES.includes(a.status ?? '') && a.payment_status === 'funded';
}

export function computeBookingConfirmation(
  job: JobState | null | undefined,
  assignments: AssignmentState[]
): BookingConfirmationState {
  if (!job) return 'awaiting_payment';

  const jobConfirmed = isJobConfirmed(job);
  const jobFunded = isJobFunded(job);

  const allAssignmentsConfirmed =
    assignments.length > 0 && assignments.every(isAssignmentConfirmed);
  const anyAssignmentStatusConfirmed = assignments.some((a) =>
    CONFIRMED_ASSIGNMENT_STATUSES.includes(a.status ?? '')
  );

  if (jobConfirmed && jobFunded && allAssignmentsConfirmed) return 'confirmed';

  if (jobConfirmed || jobFunded || anyAssignmentStatusConfirmed) return 'reconciling';

  return 'awaiting_payment';
}