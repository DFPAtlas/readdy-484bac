const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
// Execute the actual loader, stripping its type-only syntax for Node 20 CI.
const source = fs.readFileSync(path.join(__dirname, '../lib/guard-bookings.ts'), 'utf8')
  .replace(/^import type[^\n]+\n/m, '')
  .replace(/^type GuardHistoryClient = [^\n]+\n/m, '')
  .replace(/export /g, '')
  .replace(/: (?:GuardHistoryClient|string|any\[\]|any|Promise<any\[\]>)/g, '');
const { hydrateGuardJobRows, loadGuardHistoryJobs } = new Function(
  source + '; return { hydrateGuardJobRows, loadGuardHistoryJobs };'
)();

const guardId = 'synthetic-guard';
const booking = {
  job_id: 'closed-job', job_title: 'Confirmed synthetic shift',
  start_date: '2026-10-12', start_time: '09:00:00', end_time: '13:00:00',
  venue_city: 'London', venue_postcode: 'SW1A 1AA', client_name: 'UAT Client',
  job_status: 'confirmed', payment_status: 'funded', agreed_amount: 80,
  guard_payout_amount: 80, dispute_status: null,
};
function client(result) {
  return {
    from() { throw new Error('Public jobs must never be queried'); },
    functions: { async invoke(name, options) {
      assert.equal(name, 'get-guard-job-history');
      assert.deepEqual(options, { body: {} });
      return result;
    } },
  };
}
const response = (jobs = [booking]) => ({ data: { guard: { id: guardId }, jobs }, error: null });

test('closed bookings retain assignment identity, attendance controls and agreed amount', async () => {
  const row = { id: 'assignment-id', job_id: booking.job_id, status: 'confirmed',
    payment_status: 'funded', payment_amount: null, guard_confirmed_at: null,
    check_in_time: null, check_out_time: null, replacement_requested: false };
  const [loaded] = await hydrateGuardJobRows(client(response()), guardId, [row]);
  assert.equal(loaded.id, row.id);
  assert.equal(loaded.status, 'confirmed');
  assert.equal(loaded.guard_confirmed_at, null);
  assert.equal(loaded.jobs.id, booking.job_id);
  assert.equal(loaded.jobs.start_date, '2026-10-12');
  assert.equal(loaded.jobs.agreed_amount, 80);
  assert.equal(loaded.jobs.payment_status, 'funded');
  assert.equal(loaded.jobs.clients.company_name, 'UAT Client');
});

test('applications resolve the same closed job without an inner join', async () => {
  const rows = await hydrateGuardJobRows(client(response()), guardId,
    [{ id: 'application-id', job_id: booking.job_id, status: 'accepted' }]);
  assert.equal(rows[0].id, 'application-id');
  assert.equal(rows[0].jobs.job_title, booking.job_title);
});

test('a genuinely empty assignment list does not request history', async () => {
  assert.deepEqual(await hydrateGuardJobRows({}, guardId, []), []);
});

test('transport and endpoint failures cannot become an empty schedule', async () => {
  for (const result of [{ error: new Error('offline') }, { data: { error: 'Unauthorized' } }]) {
    await assert.rejects(loadGuardHistoryJobs(client(result), guardId), /Unable to load/);
  }
});

test('wrong guard and malformed history are rejected', async () => {
  for (const data of [{ guard: { id: 'other-guard' }, jobs: [booking] }, { guard: { id: guardId } }]) {
    await assert.rejects(loadGuardHistoryJobs(client({ data }), guardId), /Invalid guard/);
  }
});

test('a missing linked booking raises an error instead of hiding the assignment', async () => {
  await assert.rejects(hydrateGuardJobRows(client(response([])), guardId,
    [{ id: 'assignment-id', job_id: booking.job_id }]), /linked guard booking/);
});
