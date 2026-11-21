import { dateOnlyToUtcDate, londonCalendarDate } from './date-only';

/** Active discovery uses the UK calendar date, matching the public job list. */
export function guardJobAcceptsApplications(job: { status?: string | null; start_date?: string | null; is_deleted?: boolean | null }, now = new Date()): boolean {
  const startDate = job.start_date;
  return job.status === 'open' && job.is_deleted !== true && !!startDate && !!dateOnlyToUtcDate(startDate) &&
    startDate.slice(0, 10) >= londonCalendarDate(now);
}
