const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');

const PREVIEW = 'https://preview.amazingsite.co';
function fixture({ authenticated = true, role = 'client', failTable = null } = {}) {
  let handler;
  const calls = [];
  const rows = {
    clients: role === 'client' ? [{ id: 'client-one', user_id: 'caller' }] : [],
    admin_users: role === 'admin' ? [{ id: 'admin-one', user_id: 'caller' }] : [],
    guards: role === 'guard' ? [{ id: 'guard-one', user_id: 'caller', full_name: 'Synthetic Guard' }] : [{ id: 'guard-one', full_name: 'Synthetic Guard' }],
    job_completion_requests: [
      { id: 'own-request', job_id: 'job-one', guard_id: 'guard-one', client_id: 'client-one', status: 'pending' },
      { id: 'other-request', job_id: 'job-two', guard_id: 'guard-two', client_id: 'client-two', status: 'pending' },
    ],
    jobs: [{ id: 'job-one', job_title: 'Synthetic booking' }, { id: 'job-two', job_title: 'Other booking' }],
  };
  const db = {
    auth: { getUser: async token => ({ data: { user: authenticated && token === 'synthetic-caller-token' ? { id: 'caller' } : null } }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      let single = false;
      const q = {
        select() { return q; }, order() { return q; },
        eq(key, value) { call.filters.push([key, value]); return q; },
        in(key, values) { call.filters.push([key, { values }]); return q; },
        maybeSingle() { single = true; return q; },
        then(resolve, reject) {
          call.executed = true;
          const selected = (rows[table] || []).filter(row => call.filters.every(([key, value]) =>
            value && typeof value === 'object' ? value.values.includes(row[key]) : row[key] === value));
          return Promise.resolve({ data: table === failTable ? null : single ? selected[0] || null : selected,
            error: table === failTable ? { message: 'Synthetic read failure' } : null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  load('supabase/functions/get-completion-requests/index.ts', {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: fn => { handler = fn; } },
    'https://esm.sh/@supabase/supabase-js@2.39.0': { createClient: () => db },
  }, { Deno: { env: { get: () => 'synthetic-config' } } });
  const request = (origin = PREVIEW, method = 'POST', authenticatedHeader = true) => {
    const headers = { 'Content-Type': 'application/json' };
    if (origin !== null) headers.Origin = origin;
    if (authenticatedHeader) headers.Authorization = 'Bearer synthetic-caller-token';
    return new Request('https://synthetic.example.invalid/get-completion-requests', { method, headers,
      ...(method === 'POST' ? { body: JSON.stringify({ clientId: 'client-two', guardId: 'guard-two' }) } : {}) });
  };
  return { handler, request, calls, rows };
}

test('exact live and preview origins pass preflight without authentication or database reads', async () => {
  const f = fixture();
  for (const origin of ['https://quickguard.uk', 'https://www.quickguard.uk', PREVIEW]) {
    const response = await f.handler(f.request(origin, 'OPTIONS', false));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
    assert.match(response.headers.get('Access-Control-Allow-Headers'), /authorization/);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  }
  assert.deepEqual(f.calls, []);
});

test('untrusted, lookalike and insecure origins are rejected before reads without CORS permission', async () => {
  const f = fixture();
  for (const origin of ['https://evil.example', 'http://preview.amazingsite.co', 'https://preview.amazingsite.co.evil.example',
    'https://evil.preview.amazingsite.co', 'https://other.readdy.ai', 'null']) {
    for (const method of ['OPTIONS', 'POST']) {
      const response = await f.handler(f.request(origin, method));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
  }
  assert.deepEqual(f.calls, []);
});

test('preview is not authentication: missing or invalid session remains 401 with a readable error', async () => {
  for (const missingHeader of [true, false]) {
    const f = fixture({ authenticated: false });
    const response = await f.handler(f.request(PREVIEW, 'POST', !missingHeader));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), PREVIEW);
    assert.deepEqual(f.calls, []);
  }
});

test('preview client reads only caller-owned requests and hydrates only their jobs and guards', async () => {
  const f = fixture(); const response = await f.handler(f.request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PREVIEW);
  const result = await response.json();
  assert.deepEqual(result.requests.map(row => row.id), ['own-request']);
  assert.equal(result.requests[0].jobs.job_title, 'Synthetic booking');
  assert.equal(result.requests[0].guards.full_name, 'Synthetic Guard');
  assert.deepEqual(f.calls.find(c => c.table === 'job_completion_requests').filters, [['client_id', 'client-one']]);
  assert.deepEqual(f.calls.find(c => c.table === 'jobs').filters, [['id', { values: ['job-one'] }]]);
});

test('guard ownership, unauthorized-role rejection and successful empty queues are preserved', async () => {
  const guard = fixture({ role: 'guard' });
  assert.deepEqual((await (await guard.handler(guard.request())).json()).requests.map(row => row.id), ['own-request']);
  assert.deepEqual(guard.calls.find(c => c.table === 'job_completion_requests').filters, [['guard_id', 'guard-one']]);
  const other = fixture({ role: 'none' });
  assert.equal((await other.handler(other.request())).status, 403);
  assert.ok(!other.calls.some(c => c.table === 'job_completion_requests' && c.executed));
  const empty = fixture(); empty.rows.job_completion_requests = [];
  assert.deepEqual(await (await empty.handler(empty.request())).json(), { requests: [] });
  assert.ok(!empty.calls.some(c => c.table === 'jobs'));
});

test('read failures retain CORS headers and cannot masquerade as an empty queue; method guard remains', async () => {
  for (const table of ['job_completion_requests', 'jobs', 'guards']) {
    const f = fixture({ failTable: table }); const response = await f.handler(f.request());
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), PREVIEW);
    assert.ok(!('requests' in await response.json()));
  }
  const f = fixture();
  assert.equal((await f.handler(f.request(PREVIEW, 'GET'))).status, 405);
  assert.deepEqual(f.calls, []);
  assert.equal((await f.handler(f.request(null))).status, 200);
});
