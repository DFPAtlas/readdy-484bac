export type DateOnlyFormatOptions = Intl.DateTimeFormatOptions;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a database DATE at UTC midnight without applying the browser timezone. */
export function dateOnlyToUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = DATE_ONLY_PATTERN.exec(value.slice(0, 10));
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return null;

  return date;
}

/** Formats a database DATE without allowing the browser timezone to move it. */
export function formatDateOnly(
  value: string | null | undefined,
  options: DateOnlyFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-GB'
): string {
  const date = dateOnlyToUtcDate(value);
  if (!date) return '—';

  return date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}

/** Counts calendar days inclusively for database DATE values. */
export function inclusiveDateOnlyDays(
  startValue: string | null | undefined,
  endValue: string | null | undefined
): number {
  const start = dateOnlyToUtcDate(startValue);
  const end = dateOnlyToUtcDate(endValue || startValue);
  if (!start || !end) return 1;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}
