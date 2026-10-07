const assert = require('node:assert/strict');
const test = require('node:test');
const { getAttendanceStatus, getShiftPhase, isGuardOnSite } = require('../lib/attendance-display.cjs');
const job = { status: 'confirmed', start_date: '2026-10-12', end_date: '2026-10-12',
  start_time: '09:00:00', end_time: '13:00:00' };

test('a future confirmed and funded shift is upcoming, not ended', () => {
  assert.equal(getShiftPhase(job, new Date('2026-10-07T18:04:00Z')), 'upcoming');
});
test('a UK shift becomes active and then ends at the scheduled boundaries', () => {
  assert.equal(getShiftPhase(job, new Date('2026-10-12T07:59:59Z')), 'upcoming');
  assert.equal(getShiftPhase(job, new Date('2026-10-12T08:00:00Z')), 'active');
  assert.equal(getShiftPhase(job, new Date('2026-10-12T11:59:59Z')), 'active');
  assert.equal(getShiftPhase(job, new Date('2026-10-12T12:00:00Z')), 'ended');
});
test('overnight and multi-day shifts remain active until the actual end', () => {
  assert.equal(getShiftPhase({ ...job, start_time: '22:00:00', end_time: '06:00:00' },
    new Date('2026-10-13T02:00:00Z')), 'active');
  assert.equal(getShiftPhase({ ...job, end_date: '2026-10-14' },
    new Date('2026-10-13T09:00:00Z')), 'active');
});
test('GMT and BST use London time regardless of the browser timezone', () => {
  assert.equal(getShiftPhase({ ...job, start_date: '2026-11-12', end_date: '2026-11-12' },
    new Date('2026-11-12T08:30:00Z')), 'upcoming');
  assert.equal(getShiftPhase(job, new Date('2026-10-12T08:30:00Z')), 'active');
});
test('missing schedules do not falsely label a shift ended; terminal states are explicit', () => {
  assert.equal(getShiftPhase({ status: 'confirmed' }), 'unknown');
  assert.equal(getShiftPhase({ ...job, start_time: '99:00' }), 'unknown');
  assert.equal(getShiftPhase({ ...job, status: 'cancelled' }), 'cancelled');
  assert.equal(getShiftPhase({ ...job, status: 'completed' }), 'completed');
});
test('a saved confirmation resolves stale awaiting and empty attendance states', () => {
  for (const attendance_status of ['awaiting_confirmation', null, undefined]) {
    assert.equal(getAttendanceStatus({ attendance_status, guard_confirmed_at: '2026-10-07T18:00:07Z' }), 'confirmed');
  }
});
test('confirmation timestamps never overwrite later attendance or issue states', () => {
  for (const attendance_status of ['not_checked_in', 'checked_in', 'late', 'no_show', 'checked_out', 'completed']) {
    assert.equal(getAttendanceStatus({ attendance_status, guard_confirmed_at: '2026-10-07T18:00:07Z' }), attendance_status);
  }
  assert.equal(getAttendanceStatus({}), 'awaiting_confirmation');
  assert.equal(getAttendanceStatus({ guard_confirmed_at: 'invalid' }), 'awaiting_confirmation');
});

test('on-site count drops after checkout and completion', () => {
  const guard = { attendance_status: 'checked_in', check_in_time: '2026-10-07T19:16:16Z' };
  assert.equal(isGuardOnSite(guard), true);
  assert.equal(isGuardOnSite({ ...guard, attendance_status: 'checked_out', check_out_time: '2026-10-07T19:26:22Z' }), false);
  assert.equal(isGuardOnSite({ ...guard, attendance_status: 'completed' }), false);
  assert.equal(isGuardOnSite({ ...guard, check_out_time: '2026-10-07T19:26:22Z' }), false);
});
test('late guards count on site only after arrival', () => {
  assert.equal(isGuardOnSite({ attendance_status: 'late' }), false);
  assert.equal(isGuardOnSite({ attendance_status: 'late', check_in_time: '2026-10-07T19:30:00Z' }), true);
  for (const attendance_status of ['confirmed', 'awaiting_confirmation', 'no_show', 'not_checked_in']) {
    assert.equal(isGuardOnSite({ attendance_status }), false);
  }
});
