const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEndpoint, databaseFixture, sampleRows } = require('./helpers/client-read-fixture.cjs');

test('assigned inactive guards are identifiable without an application or a broad private profile response', async () => {
  const rows = sampleRows(); rows.job_applications = [];
  const db = databaseFixture(rows);
  const response = await loadEndpoint('get-client-assigned-guards', db)({ job_id: rows.jobs[0].id, guard_ids: ['unassigned-guard'], client_id: 'other-client' });
  assert.equal(response.status, 200); assert.equal(response.body.profiles.length, 1);
  assert.equal(response.body.profiles[0].full_name, 'Synthetic Inactive Guard');
  assert.equal(response.body.profiles[0].is_active, false);
  assert.equal(response.body.profiles[0].sia_verified, true);
  for (const key of ['phone', 'email', 'bank_account_number', 'address', 'sia_licence_front_url', 'sia_licence_back_url']) assert.equal(response.body.profiles[0][key], undefined);
  assert.equal(db.calls.some(call => call.table === 'job_applications'), false);
});

test('another client, deleted job or signed-out caller cannot obtain an assigned profile', async () => {
  for (const change of [rows => { rows.clients[0].user_id = 'other-user'; }, rows => { rows.jobs[0].client_id = 'other-client'; }, rows => { rows.jobs[0].is_deleted = true; }]) {
    const rows = sampleRows(); change(rows); const db = databaseFixture(rows);
    const result = await loadEndpoint('get-client-assigned-guards', db)({ job_id: rows.jobs[0].id });
    assert.ok([403, 404].includes(result.status));
    assert.equal(db.calls.some(call => call.table === 'guards'), false);
  }
  const rows = sampleRows(), endpoint = loadEndpoint('get-client-assigned-guards', databaseFixture(rows));
  assert.equal((await endpoint({ job_id: rows.jobs[0].id }, null)).status, 401);
  assert.equal((await endpoint({ job_id: rows.jobs[0].id }, 'invalid')).status, 401);
  assert.equal((await endpoint({ job_id: 'invalid' })).status, 400);
  assert.equal((await endpoint({}, 'test-token', 'GET')).status, 405);
});

test('unassigned guards are never returned, and failed reads cannot be presented as absent licences', async () => {
  const rows = sampleRows(); rows.guards.push({ id: 'unassigned', full_name: 'Other Guard' });
  const result = await loadEndpoint('get-client-assigned-guards', databaseFixture(rows))({ job_id: rows.jobs[0].id });
  assert.deepEqual(result.body.profiles.map(profile => profile.id), ['guard-assigned']);
  for (const failTable of ['account_closures', 'clients', 'jobs', 'job_assignments', 'guards']) {
    const db = databaseFixture(rows, { failTable });
    assert.equal((await loadEndpoint('get-client-assigned-guards', db)({ job_id: rows.jobs[0].id })).status, 503);
  }
  rows.account_closures = [{ user_id: 'user-client' }];
  assert.equal((await loadEndpoint('get-client-assigned-guards', databaseFixture(rows))({ job_id: rows.jobs[0].id })).status, 403);
});
