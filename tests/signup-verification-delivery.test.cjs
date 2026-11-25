const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { loader, hooks, nodes, text } = require('./helpers/finish-test-runtime.cjs');
const fixture = { id: 'fixture-user', email: 'synthetic@example.invalid', user_metadata: { first_name: 'Synthetic', last_name: 'Tester' }, email_confirmed_at: null };
function endpoint(name = 'register-magic-link', options = {}) {
  let handler; const writes = [], calls = [], logs = [];
  let created = 0;
  const db = { auth: { admin: {
    async createUser(input) { created++; calls.push({ createUser: input }); return options.existing ? { data: {}, error: { message: 'User already registered' } } : { data: { user: fixture }, error: null }; },
    async listUsers() { return { data: { users: options.unknown ? [] : [{ ...fixture, ...(options.verified ? { email_confirmed_at: '2026-01-01' } : {}) }] }, error: null }; },
    async generateLink(input) { calls.push({ generateLink: input }); return options.linkError ? { data: null, error: Error('private token error') } : { data: { properties: { hashed_token: 'fixture-only-hash' } }, error: null }; },
  } }, rpc: async () => ({ data: { linked: false }, error: null }), from(table) {
    let mutation = null;
    const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, maybeSingle() { return q; }, insert(row) { mutation = row; return q; }, upsert(row) { mutation = row; return q; }, then(resolve, reject) {
      if (mutation) writes.push({ table, row: mutation });
      const data = table === 'user_entitlements_data' ? { user_id: fixture.id } : ['notification_preferences', 'subscriptions'].includes(table) ? { id: 'existing' } : ['clients', 'guards'].includes(table) && !options.noProfile ? { user_id: fixture.id } : null;
      return Promise.resolve({ data, count: options.limited ? 20 : 0, error: null }).then(resolve, reject);
    } }; return q;
  } };
  load(`supabase/functions/${name}/index.ts`, { 'https://esm.sh/@supabase/supabase-js@2.47.0': { createClient: () => db } }, {
    Deno: { serve(fn) { handler = fn; }, env: { get: key => ({ SUPABASE_URL: 'https://sandbox.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })[key] } },
    console: { log(...values) { logs.push(values.join(' ')); }, error(...values) { logs.push(values.join(' ')); } },
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); if (options.networkError) throw Error('private provider detail'); return new Response(options.raw ?? JSON.stringify(options.result ?? { success: true, email_id: 'provider-accepted' }), { status: options.status || 200 }); },
  });
  return { calls, writes, logs, get created() { return created; }, async run(changes = {}) { const r = await handler(new Request('https://sandbox.example.invalid/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://quickguard.uk' }, body: JSON.stringify({ email: fixture.email, role: 'client', first_name: 'Synthetic', last_name: 'Tester', ...changes }) })); return { status: r.status, retryAfter: r.headers.get('Retry-After'), body: await r.json() }; } };
}
test('new and existing-unverified signup confirms only actual provider acceptance and never returns bearer credentials', async () => {
  for (const existing of [false, true]) for (const role of ['client', 'guard']) {
    const h = endpoint('register-magic-link', { existing }); const r = await h.run({ role }); assert.equal(r.status, 200); assert.deepEqual(r.body, { success: true, verification_sent: true });
    assert.equal(h.calls.filter(c => c.generateLink).length, 1); assert.equal(h.calls.filter(c => c.url).length, 1);
    if (!existing) { const input = h.calls.find(c => c.createUser).createUser; assert.equal(input.email_confirm, false); assert.equal(input.app_metadata.account_type, role); }
    assert.equal(h.writes.filter(w => w.table === role + 's').length, existing ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(r.body), /fixture-only-hash|password|access_token|refresh_token/);
  }
});
test('new signup and unverified retry surface all delivery failures honestly, without deleting or resetting the account', async () => {
  for (const existing of [false, true]) for (const failure of [{ status: 500 }, { result: { success: false, email_id: 'no' } }, { result: { success: true } }, { result: { success: true, email_id: ' ' } }, { raw: 'not json' }, { linkError: true }, { networkError: true }]) {
    const h = endpoint('register-magic-link', { existing, ...failure }); const r = await h.run(); assert.equal(r.status, 503); assert.equal(r.retryAfter, '60'); assert.equal(r.body.success, false); assert.equal(r.body.verification_sent, false); assert.equal(r.body.code, 'verification_delivery_failed'); assert.match(r.body.error, /awaiting verification/);
    assert.equal(h.writes.filter(w => w.table === 'clients').length, existing ? 0 : 1); assert.doesNotMatch(JSON.stringify(r.body), /private|fixture-only-hash|queue/);
    assert.equal(h.logs.some(l => /Verification email sent to/.test(l)), false);
  }
});
test('confirmed accounts, invalid roles/addresses and rate limits do not dispatch signup mail', async () => {
  for (const [options, changes, status] of [[{ existing: true, verified: true }, {}, 409], [{}, { role: 'admin' }, 400], [{}, { email: 'bad' }, 400], [{ limited: true }, {}, 429]]) {
    const h = endpoint('register-magic-link', options); assert.equal((await h.run(changes)).status, status); assert.equal(h.calls.filter(c => c.url || c.generateLink).length, 0);
  }
});
test('public resend acknowledges requests identically for known, unknown, verified, missing-profile and failed-delivery cases', async () => {
  const expected = { success: true, request_received: true };
  for (const options of [{}, { unknown: true }, { verified: true }, { noProfile: true }, { status: 500 }, { networkError: true }, { result: { success: true } }, { raw: 'invalid' }]) {
    const h = endpoint('resend-verification-link', options); const r = await h.run(); assert.equal(r.status, 200); assert.deepEqual(r.body, expected); assert.equal(h.created, 0);
    if (options.unknown || options.verified || options.noProfile) assert.equal(h.calls.filter(c => c.generateLink || c.url).length, 0);
    if (options.status || options.networkError || options.result || options.raw) assert.equal(h.logs.some(l => /Verification email sent to/.test(l)), false);
  }
});
function registrationUi(role, responseBody, status = 200) {
  const h = hooks(), routes = [], requests = [], storage = { getItem() { return null; }, setItem() {} };
  const fields = ['email', 'first_name', 'last_name'].map(field_key => ({ field_key, field_type: 'text', field_label: field_key, is_enabled: true, is_required: true }));
  const db = { auth: { getSession: async () => ({ data: { session: null } }) }, from(table) { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, maybeSingle() { return q; }, then(resolve, reject) { return Promise.resolve({ data: table === 'wizard_fields' ? fields : null }).then(resolve, reject); } }; return q; } };
  const mocks = { react: h.react, 'next/navigation': { useRouter: () => ({ push: path => routes.push(path) }) }, 'next/link': { default: () => null }, '@/lib/supabase': { supabase: db } };
  for (const name of ['@/components/TaxDisclaimerCheckbox', '@/components/login/RegisterMarketingPanel', '@/components/login/RegisterFormCard', '@/components/BrandLogo', '@/components/login/SocialConsentNotice', '@/components/qg-rewards/QGExitIntentPopup', './GuardPromoBanner']) mocks[name] = { default: () => null };
  const Component = loader(mocks, { window: { location: { origin: 'http://127.0.0.1:3100', search: '' } }, localStorage: storage, sessionStorage: storage, console: { error() {}, log() {} }, fetch: async (_url, init) => { requests.push(JSON.parse(init.body)); return new Response(JSON.stringify(responseBody), { status }); } })(`app/${role}/register/page.tsx`).default;
  return { h, routes, requests, render: () => h.render(Component) };
}
test('actual client and guard forms retain input, show a retryable error and do not navigate on unconfirmed email', async () => {
  for (const role of ['client', 'guard']) for (const [body, status] of [[{ success: false, verification_sent: false, error: 'Your account is awaiting verification. Please retry.' }, 503], [{ success: true, verification_sent: false }, 200], [{ success: true }, 200], [null, 200]]) {
    const r = registrationUi(role, body, status); r.render(); await r.h.effects(); let tree = r.render();
    for (const [name, value] of Object.entries({ email: fixture.email, first_name: 'Synthetic', last_name: 'Tester' })) nodes(tree).find(n => n.props?.name === name).props.onChange({ target: { name, value } });
    tree = r.render(); await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); tree = r.render();
    assert.deepEqual(r.routes, []); assert.equal(nodes(tree).find(n => n.props?.name === 'email').props.value, fixture.email); assert.match(text(tree), /awaiting verification|could not confirm/);
    assert.equal(r.requests.length, 1); assert.equal(r.requests[0].role, role); r.h.unmount();
  }
});
test('actual registration forms navigate only on explicit email acceptance', async () => {
  for (const role of ['client', 'guard']) {
    const r = registrationUi(role, { success: true, verification_sent: true }); r.render(); await r.h.effects(); let tree = r.render(); nodes(tree).find(n => n.props?.name === 'email').props.onChange({ target: { name: 'email', value: fixture.email } }); tree = r.render(); await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.deepEqual(r.routes, ['/auth/verify-email?email=' + encodeURIComponent(fixture.email) + '&role=' + role]); r.h.unmount();
  }
});
