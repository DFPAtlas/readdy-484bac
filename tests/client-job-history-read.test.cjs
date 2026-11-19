const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadEndpoint, databaseFixture, sampleRows } = require('./helpers/client-read-fixture.cjs');

test('relationship fixture reproduces the live PGRST200 failure even with no client reviews', async () => {
  const db = databaseFixture(sampleRows());
  const failed = await db.from('client_reviews').select('id, guards(full_name)');
  assert.equal(failed.error.code, 'PGRST200');
});

test('history loads even when client reviews have no foreign key relationship to guards', async () => {
  const rows = sampleRows(), db = databaseFixture(rows);
  const result = await loadEndpoint('get-client-job-history', db)({ pageSize: 50 });
  assert.equal(result.status, 200);
  assert.equal(result.body.jobs.length, 12);
  assert.equal(result.body.totalCount, 12);
  assert.equal(db.calls.find(call => call.table === 'client_reviews').fields.includes('guards'), false);
});

test('review names come only from owned job reviews and never require an assignment', async () => {
  const rows = sampleRows(), job = rows.jobs[0];
  rows.job_assignments = []; rows.job_applications = [];
  rows.guards.push({ id: 'foreign-guard', full_name: 'Foreign Guard', phone: 'private' });
  rows.client_reviews = [
    { id: 'owned-review', client_id: job.client_id, job_id: job.id, guard_id: 'guard-assigned', rating: 5, comment: 'Synthetic client review' },
    { id: 'foreign-job-review', client_id: job.client_id, job_id: 'foreign-job', guard_id: 'foreign-guard' },
    { id: 'foreign-client-review', client_id: 'other-client', job_id: job.id, guard_id: 'foreign-guard' },
  ];
  const db = databaseFixture(rows);
  const result = await loadEndpoint('get-client-job-history', db)({ pageSize: 50 });
  assert.equal(result.status, 200);
  const reviews = result.body.jobs.find(row => row.job_id === job.id).client_reviews;
  assert.deepEqual(reviews.map(review => review.id), ['owned-review']);
  assert.equal(reviews[0].guard_name, 'Synthetic Inactive Guard');
  assert.equal(reviews[0].comment, 'Synthetic client review');
  const profileRead = db.calls.find(call => call.table === 'guards');
  assert.equal(profileRead.fields, 'id, full_name');
  assert.equal(profileRead.filters.every(filter => filter(rows.guards[1])), false);
  assert.equal(JSON.stringify(result.body).includes('Foreign Guard'), false);
  assert.equal(JSON.stringify(reviews).includes('private'), false);
});

test('missing review profiles are explicit; failed name reads fail the request', async () => {
  const rows = sampleRows(), job = rows.jobs[0];
  rows.client_reviews = [{ id: 'review', client_id: job.client_id, job_id: job.id, guard_id: 'removed-guard', rating: 4 }];
  const missing = await loadEndpoint('get-client-job-history', databaseFixture(rows))({ pageSize: 50 });
  assert.equal(missing.status, 200);
  assert.equal(missing.body.jobs.find(row => row.job_id === job.id).client_reviews[0].guard_name, 'Guard profile unavailable');
  const failed = await loadEndpoint('get-client-job-history', databaseFixture(rows, { failTable: 'guards' }))({ pageSize: 50 });
  assert.equal(failed.status, 500);
  assert.equal(failed.body.jobs, undefined);
});

test('history uses deployed application columns, returns owned jobs and paginates deterministically', async () => {
  const db = databaseFixture(sampleRows());
  const endpoint = loadEndpoint('get-client-job-history', db);
  const first = await endpoint({ page: 1, pageSize: 5 });
  const second = await endpoint({ page: 2, pageSize: 5 });
  assert.equal(first.status, 200); assert.equal(first.body.totalCount, 12);
  assert.equal(first.body.jobs.length, 5); assert.equal(second.body.jobs.length, 5);
  assert.equal(new Set([...first.body.jobs, ...second.body.jobs].map(row => row.job_id)).size, 10);
  const final = await endpoint({ page: 3, pageSize: 5 });
  assert.equal(final.body.jobs.length, 2);
  const completed = final.body.jobs.find(row => row.job_status === 'completed');
  assert.equal(completed.guards[0].full_name, 'Synthetic Inactive Guard');
  assert.equal(completed.reviews[0].comment, 'Synthetic review');
  assert.equal(completed.transactions[0].stripe_payment_intent_id, 'pi_synthetic');
  assert.equal(completed.refund_amount, 3);
  assert.equal(completed.guards[0].phone, undefined);
});

test('history filters search, date, status, payment and guard before selecting a page', async () => {
  const endpoint = loadEndpoint('get-client-job-history', databaseFixture(sampleRows()));
  assert.equal((await endpoint({ search: 'London' })).body.totalCount, 6);
  assert.equal((await endpoint({ status: 'completed' })).body.totalCount, 1);
  assert.equal((await endpoint({ payment: 'paid' })).body.totalCount, 1);
  assert.equal((await endpoint({ dateFrom: '2026-11-21' })).body.totalCount, 0);
  const guards = await endpoint({ guardSearch: 'Inactive Guard', pageSize: 5 });
  assert.equal(guards.status, 200); assert.equal(guards.body.totalCount, 2);
  assert.equal(guards.body.jobs.length, 2);
  assert.equal((await endpoint({ guardSearch: 'No Such Guard' })).body.totalCount, 0);
});

test('history rejects every failed database source instead of returning a false empty result', async () => {
  for (const failTable of ['account_closures', 'clients', 'jobs', 'job_assignments', 'job_applications', 'job_completion_requests', 'disputes', 'reviews', 'client_reviews', 'payment_audit_logs', 'transactions']) {
    const endpoint = loadEndpoint('get-client-job-history', databaseFixture(sampleRows(), { failTable }));
    const result = await endpoint({ pageSize: 50 });
    assert.equal(result.status, 500, failTable);
    assert.ok(result.body.error); assert.equal(result.body.jobs, undefined);
  }
  const guardSearch = loadEndpoint('get-client-job-history', databaseFixture(sampleRows(), { failTable: 'job_applications' }));
  assert.equal((await guardSearch({ guardSearch: 'Guard' })).status, 500);
});

test('history distinguishes an empty client account from missing client access or sign-out', async () => {
  const rows = sampleRows(); rows.jobs = [];
  const empty = await loadEndpoint('get-client-job-history', databaseFixture(rows))();
  assert.equal(empty.status, 200); assert.equal(empty.body.totalCount, 0); assert.deepEqual(empty.body.jobs, []);
  rows.clients = [];
  assert.equal((await loadEndpoint('get-client-job-history', databaseFixture(rows))()).status, 403);
  const endpoint = loadEndpoint('get-client-job-history', databaseFixture(sampleRows()));
  assert.equal((await endpoint({}, null)).status, 401);
  assert.equal((await endpoint({}, 'invalid')).status, 401);
  assert.equal((await endpoint({}, 'test-token', 'GET')).status, 405);
  assert.equal((await endpoint({ search: ['invalid'] })).status, 400);
  const closed = sampleRows(); closed.account_closures = [{ user_id: 'user-client' }];
  assert.equal((await loadEndpoint('get-client-job-history', databaseFixture(closed))()).status, 403);
});

test('history error state does not also announce an empty account', () => {
  const source = fs.readFileSync('app/client/job-history/page.tsx', 'utf8');
  assert.ok(source.includes('jobs.length === 0 && !loading && !error'));
  assert.ok(source.includes("error ? 'Results unavailable'"));
  assert.ok(source.includes('(loading || refreshing) && jobs.length === 0'));
  assert.ok(source.includes('!error && !refreshing'));
});
