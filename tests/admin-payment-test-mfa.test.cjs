const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
function harness(options = {}) {
  let handler, constructors = 0; const calls = [], writes = [];
  const actor = { auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: 'verified-user', user_metadata: { role: 'super_admin', aal: 'aal2' } } }, error: null }) }, rpc(name) { calls.push({ rpc: name }); return { then(resolve, reject) { return Promise.resolve().then(() => { if (options.rpcThrows) throw Error('private database detail'); return { data: Object.hasOwn(options, 'mfa') ? options.mfa : true, error: options.rpcError ? Error('private database detail') : null }; }).then(resolve, reject); } }; } };
  const adminDb = { from(table) { calls.push({ table }); const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: { id: 'admin', role: options.role || 'finance_admin', is_active: options.active !== false }, error: null }; }, insert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }); } }; return q; } };
  load('supabase/functions/admin-test-job-payment/index.ts', {
    '../_shared/payment-freeze.ts': { paymentFreezeResponse: async () => options.frozen ? new Response(JSON.stringify({ code: 'payments_paused' }), { status: 503 }) : null },
    'https://deno.land/std@0.168.0/http/server.ts': { serve(fn) { handler = fn; } },
    'https://esm.sh/stripe@14.10.0?target=deno': class Stripe { constructor() { constructors++; } },
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient(_url, key, config) { calls.push({ client: key, config }); if (key === 'fixture-anon') { assert.equal(config.global.headers.Authorization, 'Bearer verified-token'); assert.equal(config.db.schema, 'app'); return actor; } return adminDb; } },
  }, { Deno: { env: { get: name => ({ SUPABASE_URL: 'https://sandbox.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', SUPABASE_ANON_KEY: 'fixture-anon', STRIPE_SECRET_KEY: options.live ? 'sk_live_fixture' : 'sk_test_fixture' })[name] } } });
  return { calls, writes, get constructors() { return constructors; }, async run(body = { action: 'check_mode' }, token = 'verified-token') { const r = await handler(new Request('https://sandbox.example.invalid/admin-test', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; } };
}
test('every admin payment-test action rejects AAL1, inactive membership and spoofed role/MFA before service access or Stripe initialization', async () => {
  for (const mfa of [false, null, 'true']) for (const action of ['check_mode', 'get_status_snapshot', 'create_checkout', 'simulate_funded', 'simulate_completion', 'approve_completion', 'create_payout']) {
    const h = harness({ mfa }); const r = await h.run({ action, role: 'super_admin', aal: 'aal2', is_active: true }); assert.equal(r.status, 403); assert.equal(h.constructors, 0); assert.equal(h.calls.some(c => c.client === 'fixture-service'), false); assert.deepEqual(h.writes, []);
  }
});
test('MFA verification errors and transport exceptions fail closed without exposing details or creating provider objects', async () => {
  for (const options of [{ rpcError: true }, { rpcThrows: true }]) { const h = harness(options); const r = await h.run({ action: 'simulate_funded' }); assert.equal(r.status, 503); assert.equal(h.constructors, 0); assert.deepEqual(h.writes, []); assert.doesNotMatch(JSON.stringify(r.body), /private/); }
});
test('verified MFA still requires the current active finance or super-admin role', async () => {
  for (const options of [{ role: 'support_admin' }, { active: false }]) { const h = harness(options); assert.equal((await h.run()).status, 403); assert.equal(h.constructors, 0); }
  for (const role of ['finance_admin', 'super_admin']) { const h = harness({ role }); const r = await h.run(); assert.equal(r.status, 200); assert.equal(r.body.isTestMode, true); assert.equal(h.calls.filter(c => c.rpc === 'is_active_admin').length, 1); assert.deepEqual(h.writes, []); }
});
test('authentication, emergency freeze and live-mode mutation blocking remain enforced', async () => {
  const anonymous = harness(); assert.equal((await anonymous.run(undefined, null)).status, 401); assert.equal(anonymous.constructors, 0);
  const signedOut = harness({ signedOut: true }); assert.equal((await signedOut.run()).status, 401); assert.equal(signedOut.calls.some(c => c.rpc), false);
  const frozen = harness({ frozen: true }); assert.equal((await frozen.run()).status, 503); assert.equal(frozen.calls.length, 0);
  const live = harness({ live: true }); const read = await live.run(); assert.equal(read.body.mode, 'live'); const blocked = await live.run({ action: 'simulate_funded' }); assert.equal(blocked.status, 400); assert.equal(blocked.body.error, 'LIVE_MODE_BLOCKED'); assert.deepEqual(live.writes, []);
});
