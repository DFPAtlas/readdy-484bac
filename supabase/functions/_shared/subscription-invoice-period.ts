function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function record(value: unknown) { return isRecord(value) ? value : null; }
export function unixTime(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
/** Invoice root periods describe accrual; recurring service periods belong to lines. */
export function invoiceServicePeriod(value: unknown, subscriptionId: string): { start: string | null; end: string | null } {
  const lines = record(record(value)?.lines);
  if (lines?.has_more === true || !Array.isArray(lines?.data)) return { start: null, end: null };
  const periods = lines.data.flatMap((value: unknown) => {
    const line = record(value), details = record(record(line?.parent)?.subscription_item_details);
    const reference = line?.subscription || details?.subscription;
    const id = typeof reference === 'string' ? reference : record(reference)?.id;
    if (id !== subscriptionId || line?.proration === true || details?.proration === true) return [];
    const period = record(line?.period), start = unixTime(period?.start), end = unixTime(period?.end);
    return start && end && start < end ? [{ start, end }] : [];
  });
  if (!periods.length || periods.some(p => p.start !== periods[0].start || p.end !== periods[0].end)) return { start: null, end: null };
  return periods[0];
}
