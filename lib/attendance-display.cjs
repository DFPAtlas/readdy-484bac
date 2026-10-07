/** Resolve display state from persisted confirmation without losing attendance outcomes.
 * @param {{attendance_status?: string|null, guard_confirmed_at?: string|null}} assignment
 * @returns {string}
 */
function getAttendanceStatus(assignment) {
  const status = assignment.attendance_status;
  if ((!status || status === 'awaiting_confirmation') &&
      assignment.guard_confirmed_at && Number.isFinite(Date.parse(assignment.guard_confirmed_at))) {
    return 'confirmed';
  }
  return status || 'awaiting_confirmation';
}

/** Compare a UK shift with the UK wall clock, independent of the viewer's timezone.
 * @param {{status?: string|null, start_date?: string|null, end_date?: string|null, start_time?: string|null, end_time?: string|null}} job
 * @param {Date} [now]
 * @returns {'upcoming'|'active'|'ended'|'completed'|'cancelled'|'unknown'}
 */
function getShiftPhase(job, now = new Date()) {
  if (['cancelled', 'refunded'].includes(job.status || '')) return 'cancelled';
  if (job.status === 'completed') return 'completed';
  const startDate = job.start_date;
  const endDate = job.end_date || startDate;
  const startTime = job.start_time?.slice(0, 8);
  const endTime = job.end_time?.slice(0, 8);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
  if (!validDate(startDate) || !validDate(endDate) || !validTime(startTime) || !validTime(endTime) ||
      !Number.isFinite(now.getTime())) return 'unknown';
  const start = startDate + 'T' + startTime.padEnd(8, ':00');
  let end = endDate + 'T' + endTime.padEnd(8, ':00');
  // A single-day overnight booking finishes the following morning.
  if (endDate === startDate && end <= start) {
    const nextDate = new Date(endDate + 'T00:00:00Z');
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    end = nextDate.toISOString().slice(0, 10) + 'T' + endTime.padEnd(8, ':00');
  }
  if (end <= start) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const clock = values.year + '-' + values.month + '-' + values.day + 'T' +
    values.hour + ':' + values.minute + ':' + values.second;
  if (clock < start) return 'upcoming';
  if (clock < end) return 'active';
  return 'ended';
}

module.exports = { getAttendanceStatus, getShiftPhase };
