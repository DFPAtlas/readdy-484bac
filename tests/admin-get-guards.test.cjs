const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { load } = require('./helpers/enterprise-module.cjs');

// Exercise the real handler with local Auth/database doubles; never contact production.
const token = (claims = {}) => ['header', Buffer.from(JSON.stringify({ sub: 'untrusted-claim', email: 'claim@example.invalid', aal: 'aal2', ...claims })).toString('base64url'), 'signature'].join('.');
function fixture(options = {}) {
  const calls = [];
  let handler;
  const rows = Array.from({ length: 125 }, (_, id) => ({ id, verification_status: 'pending', profile_completed: false }));
  const client = {
    auth: { async getUser(value) {
      calls.push(['getUser', value]);
      if (options.authThrows) throw new Error('Auth unavailable');
      return { data: { user: options.revoked ? null : { id: 'verified-user' } }, error: options.revoked ? new Error('Session revoked') : null };
    } },
    from(table) {
      calls.push(['from', table]);
      let bounds = [0, rows.length - 1];
      const query = {
        select(...args) { calls.push([table, 'select', ...args]); return query; },
        eq(...args) { calls.push([table, 'eq', ...args]); return query; },
        in(...args) { calls.push([table, 'in', ...args]); return query; },
        order(...args) { calls.push([table, 'order', ...args]); return query; },
        range(from, to) { bounds = [from, to]; calls.push([table, 'range', from, to]); return query; },
        async maybeSingle() {
          return { data: options.missingAdmin ? null : { id: 'admin', role: 'admin', is_active: true, ...options.admin }, error: options.adminError ? new Error('Lookup failed') : null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: options.queryError ? null : rows.slice(bounds[0], bounds[1] + 1), count: rows.length, error: options.queryError ? { message: 'Query unavailable' } : null }).then(resolve, reject);
        },
        update() { throw new Error('Read handler attempted a write'); },
        insert() { throw new Error('Read handler attempted a write'); },
        delete() { throw new Error('Read handler attempted a write'); },
      };
      return query;
    },
  };
  load('supabase/functions/get-guards/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient(url, key, config) { calls.push(['createClient', config]); return client; } },
  }, { Deno: { env: { get: name => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'local-service', SUPABASE_ANON_KEY: 'local-anon' })[name] }, serve: value => { handler = value; } } });
  return { calls, async request({ method = 'GET', auth = `Bearer ${token()}`, query = '', body, origin = 'https://quickguard.uk' } = {}) {
    const headers = { origin };
    if (auth !== null) headers.Authorization = auth;
    const response = await handler(new Request(`https://example.invalid/get-guards${query}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
  } };
}
const guardReads = calls => calls.filter(c => c[0] === 'from' && c[1] === 'guards');

test('get-guards handles preflight and unsupported methods without Auth or database access', async () => {
  for (const [method, status] of [['OPTIONS', 204], ['DELETE', 405]]) {
    const f = fixture();
    assert.equal((await f.request({ method })).status, status);
    assert.deepEqual(f.calls, []);
  }
});

test('get-guards rejects missing, malformed, blank and anonymous bearer credentials before creating a service client', async () => {
  for (const auth of [null, 'Basic test', 'Bearer ', 'Bearer local-anon']) {
    const f = fixture();
    assert.equal((await f.request({ auth })).status, 401);
    assert.deepEqual(f.calls, []);
  }
});

test('get-guards rejects revoked or unverified tokens even when claims say aal2/admin', async () => {
  for (const options of [{ revoked: true }, { authThrows: true }]) {
    const f = fixture(options);
    assert.equal((await f.request()).status, 401);
    assert.equal(f.calls.filter(c => c[0] === 'from').length, 0);
  }
});

test('get-guards binds admin lookup to the verified Auth user, never JWT email/sub or account rebinding', async () => {
  const f = fixture();
  assert.equal((await f.request()).status, 200);
  assert.deepEqual(f.calls.filter(c => c[0] === 'admin_users' && c[1] === 'eq'), [['admin_users', 'eq', 'user_id', 'verified-user']]);
  assert.deepEqual(f.calls.find(c => c[0] === 'createClient')[1], { db: { schema: 'app' } });
});

test('get-guards requires MFA before looking up admin or guard records', async () => {
  for (const aal of ['aal1', null, undefined]) {
    const f = fixture();
    assert.equal((await f.request({ auth: `Bearer ${token({ aal })}` })).status, 403);
    assert.equal(f.calls.filter(c => c[0] === 'from').length, 0);
  }
});

test('get-guards denies missing, inactive, failed and unpermitted admin lookups', async () => {
  for (const options of [{ missingAdmin: true }, { adminError: true }, { admin: { is_active: false } }, { admin: { role: 'viewer' } }, { admin: { role: 'viewer', permissions: { guards: 'true' } } }]) {
    const f = fixture(options);
    assert.equal((await f.request()).status, 403);
    assert.deepEqual(guardReads(f.calls), []);
  }
});

test('get-guards preserves supported admin roles and explicit guard permission grants', async () => {
  const admins = ['admin', 'super_admin', 'finance_admin'].map(role => ({ role }));
  for (const permission of ['guard_verification', 'guard-verification', 'guards', 'verify_guards']) {
    admins.push({ role: 'custom', permissions: { [permission]: true } }, { role: 'custom', permissions: [permission] });
  }
  for (const admin of admins) assert.equal((await fixture({ admin }).request()).status, 200);
});

test('get-guards uses an explicit field allowlist and exact count with the default 50-row page', async () => {
  const f = fixture();
  const result = await f.request();
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 50);
  assert.equal(result.body.totalCount, 125);
  assert.equal(result.body.page, 1);
  assert.equal(result.body.pageSize, 50);
  const selection = f.calls.find(c => c[0] === 'guards' && c[1] === 'select');
  assert.equal(selection[2].includes('*'), false);
  assert.ok(selection[2].split(',').includes('verification_status'));
  assert.equal(selection[2].split(',').includes('password'), false);
  assert.deepEqual(selection[3], { count: 'exact' });
  assert.deepEqual(f.calls.find(c => c[0] === 'guards' && c[1] === 'range'), ['guards', 'range', 0, 49]);
  assert.deepEqual(f.calls.filter(c => c[0] === 'guards' && c[1] === 'order'), [
    ['guards', 'order', 'created_at', { ascending: false }],
    ['guards', 'order', 'id', { ascending: false }],
  ]);
  assert.deepEqual(f.calls.find(c => c[0] === 'guards' && c[1] === 'in'), ['guards', 'in', 'verification_status', ['pending', 'manual_review', 'pending_sia_check']]);
});

test('get-guards supports GET and POST paging and caps requested page size at 100', async () => {
  for (const request of [{ query: '?status=all&page=2&pageSize=1000' }, { method: 'POST', body: { status: 'all', page: 2, pageSize: 1000 } }]) {
    const f = fixture();
    const result = await f.request(request);
    assert.equal(result.body.pageSize, 100);
    assert.equal(result.body.page, 2);
    assert.equal(result.body.count, 25);
    assert.equal(result.body.totalCount, 125);
    assert.deepEqual(f.calls.find(c => c[0] === 'guards' && c[1] === 'range'), ['guards', 'range', 100, 199]);
  }
});

test('get-guards preserves approved/incomplete filters and validates status before reading guards', async () => {
  for (const request of [{ query: '?status=approved&incomplete=true' }, { method: 'POST', body: { status: 'approved', incompleteOnly: true } }]) {
    const f = fixture();
    assert.equal((await f.request(request)).status, 200);
    assert.ok(f.calls.some(c => c[0] === 'guards' && c[1] === 'in' && JSON.stringify(c[3]) === JSON.stringify(['approved', 'verified'])));
    assert.ok(f.calls.some(c => c[0] === 'guards' && c[1] === 'eq' && c[2] === 'profile_completed' && c[3] === false));
  }
  const f = fixture();
  assert.equal((await f.request({ query: '?status=unknown' })).status, 400);
  assert.deepEqual(guardReads(f.calls), []);
});

test('get-guards reports database failures without returning success or guard data', async () => {
  const result = await fixture({ queryError: true }).request();
  assert.equal(result.status, 500);
  assert.equal(result.body.success, undefined);
  assert.equal(result.body.data, undefined);
});

test('get-guards pins the deployed gateway JWT verification setting', () => {
  const config = fs.readFileSync('supabase/config.toml', 'utf8');
  const section = config.split('[functions.get-guards]')[1]?.split('\n[')[0];
  assert.match(section || '', /verify_jwt\s*=\s*true/);
});
