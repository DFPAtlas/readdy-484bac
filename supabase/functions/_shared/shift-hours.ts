// Authoritative scheduled-hours calculation for QuickGuard bookings.
// A job is one daily shift (start_time -> end_time, overnight when the finish is
// at or before the start) repeated on number_of_days days. Payable hours per
// guard are shift hours x days. The elapsed span between the first start and the
// final finish must never be multiplied by the day count again.
// Mirrors lib/shift-hours.ts and app.job_scheduled_hours() — keep all three aligned.

function minutesOf(value: string | null | undefined): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) throw new Error('Shift start and finish times are required');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error('Shift time is invalid');
  return hours * 60 + minutes;
}

export function shiftHours(startTime: string | null | undefined, endTime: string | null | undefined): number {
  let minutes = minutesOf(endTime) - minutesOf(startTime);
  if (minutes <= 0) minutes += 24 * 60; // overnight (or a full 24-hour shift)
  return minutes / 60;
}

export function scheduledDays(numberOfDays: unknown, startDate?: string | null, endDate?: string | null): number {
  const explicit = Number(numberOfDays);
  if (Number.isInteger(explicit) && explicit >= 1) return explicit;
  if (startDate) {
    const start = Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`);
    const end = Date.parse(`${String(endDate || startDate).slice(0, 10)}T00:00:00Z`);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return Math.round((end - start) / 86400000) + 1;
  }
  return 1;
}

export interface ScheduleInput {
  start_time?: string | null;
  end_time?: string | null;
  number_of_days?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/** Payable hours for ONE guard across the whole booking, rounded to 2dp. */
export function scheduledHoursPerGuard(job: ScheduleInput): number {
  const hours = shiftHours(job.start_time, job.end_time) * scheduledDays(job.number_of_days, job.start_date, job.end_date);
  return Math.round(hours * 100) / 100;
}

/** Gross guard pay in pence for one guard. */
export function grossGuardPence(hourlyRate: number, job: ScheduleInput): number {
  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Hourly rate is invalid');
  return Math.round(rate * scheduledHoursPerGuard(job) * 100);
}
