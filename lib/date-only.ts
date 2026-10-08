export type DateOnlyFormatOptions = Intl.DateTimeFormatOptions;

/** Formats a database DATE without allowing the browser timezone to move it. */
export function formatDateOnly(
  value: string | null | undefined,
  options: DateOnlyFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-GB'
): string {
  if (!value) return '—';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return '—';

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return '—';

  return date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}
