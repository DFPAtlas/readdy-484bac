const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

function fixture(rows = [{ id: 'request', job_id: 'job', guard_id: 'guard', status: 'pending' }]) {
  const calls = [];
  const db = { fail: null, rows, from(table) {
    const call = { table }; calls.push(call);
    const q = {
      select(fields) { call.fields = fields; return q; }, order() { return q; }, limit() { return q; },
      in(key, ids) { call.ids = ids; return q; },
      then(resolve, reject) {
        const data = table === 'job_completion_requests' ? db.rows : table === 'jobs'
          ? [{ id: 'job', job_title: 'Test job', venue_city: 'London', agreed_amount: 80 }]
          : [{ id: 'guard', full_name: 'Test guard' }];
        const error = table === db.fail || call.fields.includes('(')
          ? { message: 'No relationship in schema cache', code: 'PGRST200' } : null;
        return Promise.resolve({ data: error ? null : data, error }).then(resolve, reject);
      },
    }; return q;
  } };
  const h = hooksHarness('app/admin/jobs/CompletionRequestsPanel.tsx', {
    '@/lib/supabase': { supabase: db }, '@/lib/adminFunction': { adminFunction() { throw new Error('Unexpected payment action'); } },
  }, { setTimeout: () => 1, clearTimeout() {} });
  return { h, db, calls };
}

test('completion panel hydrates only referenced jobs/guards without requiring foreign keys', async () => {
  const { h, calls } = fixture(); h.render(); await h.effects();
  const tree = h.render();
  const table = nodes(tree).find(node => node.props?.requests);
  assert.equal(table.props.requests[0].jobs.job_title, 'Test job');
  assert.equal(table.props.requests[0].guards.full_name, 'Test guard');
  assert.deepEqual(calls.find(call => call.table === 'jobs').ids, ['job']);
  assert.deepEqual(calls.find(call => call.table === 'guards').ids, ['guard']);
  h.unmount();
});

test('completion read or hydration failure stays visible, hides zero counts and recovers through Retry', async () => {
  for (const table of ['job_completion_requests', 'jobs', 'guards']) {
    const { h, db } = fixture(); db.fail = table; h.render(); await h.effects();
    let tree = h.render();
    assert.match(content(tree), /Unable to load completion requests/);
    assert(nodes(tree).some(node => node.props?.role === 'alert'));
    assert(!nodes(tree).some(node => node.props?.counts || node.props?.requests));
    db.fail = null;
    await nodes(tree).find(node => node.type === 'button' && content(node) === 'Retry completion requests').props.onClick();
    tree = h.render();
    assert.doesNotMatch(content(tree), /Unable to load completion requests/);
    assert.equal(nodes(tree).find(node => node.props?.requests).props.requests.length, 1);
    h.unmount();
  }
});

test('a successful empty completion queue performs no related reads and shows genuine zero counts', async () => {
  const { h, calls } = fixture([]); h.render(); await h.effects();
  const tree = h.render();
  assert.equal(nodes(tree).find(node => node.props?.counts).props.counts.all, 0);
  assert.equal(nodes(tree).find(node => node.props?.requests).props.requests.length, 0);
  assert.equal(calls.length, 1); h.unmount();
});

test('cleanup log reader uses the admin endpoint with session and pagination, and rejects unavailable data', async () => {
  const { load } = require('./helpers/enterprise-module.cjs');
  const calls = []; let response = { cleanup: { logs: [], total_count: 420 } }; let session = { access_token: 'fixture' };
  const reader = load('lib/adminMaintenance.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session } }) } } },
  }, { fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => response }; } });
  assert.deepEqual(await reader.loadAdminCleanupLogs(15, 15), { logs: [], totalCount: 420 });
  assert.match(calls[0].url, /section=maintenance&cleanup_offset=15&cleanup_limit=15$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture');
  response = { cleanup: { logs: null, total_count: null } };
  await assert.rejects(reader.loadAdminCleanupLogs(), /Unable to load cleanup/);
  session = null; await assert.rejects(reader.loadAdminCleanupLogs(), /session expired/);
  assert.equal(calls.length, 2);
});
