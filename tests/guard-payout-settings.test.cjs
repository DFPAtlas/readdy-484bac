const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = (file, jsx = false) => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined, esModuleInterop: true,
} }).outputText;
const box = { exports: {} }; new Function('exports', compile('lib/guard-payout-settings.ts'))(box.exports);
const api = box.exports;
const ready = { connected: true, detailsSubmitted: true, payoutsEnabled: true, transfersEnabled: true,
  status: 'ready', requirementsDue: [], restrictedReason: null, lastCheckedAt: '2026-11-18T00:00:00Z' };
const notStarted = { ...ready, connected: false, detailsSubmitted: false, payoutsEnabled: false, transfersEnabled: false, status: 'not_started' };
const session = userId => ({ data: { session: { access_token: 'fixture_token', user: { id: userId } } }, error: null });
const options = fetcher => ({ baseUrl: 'https://example.test', publishableKey: 'fixture_public_key', fetcher });

// Exported for the separate lifecycle regression tests.
module.exports = { api, ready, notStarted, compile };

test('payout profile reads only supported identity columns and handles signed-out, missing and failed reads', async () => {
  const queries = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) }, from(table) {
    assert.equal(table, 'guards'); const query = { select(fields) { queries.push(fields); assert.equal(fields, 'id,full_name'); return this; },
      eq(key, value) { assert.deepEqual([key, value], ['user_id', 'user']); return this; }, maybeSingle: async () => ({ data: { id: 'guard', full_name: 'Guard Name' }, error: null }) }; return query;
  } };
  assert.deepEqual(await api.loadGuardPayoutProfile(client), { id: 'guard', userId: 'user', fullName: 'Guard Name' });
  client.from = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: { message: 'denied' } }) });
  await assert.rejects(api.loadGuardPayoutProfile(client), /could not be loaded/);
  client.from = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) });
  await assert.rejects(api.loadGuardPayoutProfile(client), /No guard profile/);
  client.auth.getUser = async () => ({ data: { user: null }, error: null });
  assert.equal(await api.loadGuardPayoutProfile(client), null); assert.equal(queries.length, 1);
});

test('ready status requires transfers and bank payouts; malformed or contradictory data never claims readiness', () => {
  assert.equal(api.parseGuardStripeStatus(ready).status, 'ready');
  assert.equal(api.parseGuardStripeStatus(notStarted).connected, false);
  for (const patch of [{ payoutsEnabled: false }, { transfersEnabled: false }, { connected: false }, { detailsSubmitted: false },
    { restrictedReason: 'requirements.past_due' }, { requirementsDue: ['individual.id_number'] }, { lastCheckedAt: 'invalid' }, { connected: 1 }, { status: 'other' }]) {
    assert.throws(() => api.parseGuardStripeStatus({ ...ready, ...patch }), /could not be confirmed/);
  }
  assert.throws(() => api.parseGuardStripeStatus(null), /could not be confirmed/);
});

test('Stripe requests use the current owner session and empty body, and verify status failures', async () => {
  const calls = []; const client = { auth: { getSession: async () => session('user') } };
  const fetcher = async (url, request) => { calls.push({ url, request }); return Response.json(ready); };
  assert.equal((await api.requestGuardStripe(client, 'get-guard-stripe-status', 'user', options(fetcher))).status, 'ready');
  assert.equal(calls[0].request.headers.Authorization, 'Bearer fixture_token');
  assert.equal(calls[0].request.headers.apikey, 'fixture_public_key');
  assert.deepEqual(JSON.parse(calls[0].request.body), {});
  client.auth.getSession = async () => session('other');
  await assert.rejects(api.requestGuardStripe(client, 'get-guard-stripe-status', 'user', options(fetcher)), /account has changed/);
  client.auth.getSession = async () => ({ data: { session: null }, error: null });
  await assert.rejects(api.requestGuardStripe(client, 'get-guard-stripe-status', 'user', options(fetcher)), /session has expired/);
  assert.equal(calls.length, 1);
  client.auth.getSession = async () => session('user');
  for (const response of [Response.json({ error: 'failed' }, { status: 500 }), new Response('invalid json'), Response.json({ ...ready, transfersEnabled: false })]) {
    await assert.rejects(api.requestGuardStripe(client, 'get-guard-stripe-status', 'user', options(async () => response)));
  }
});

test('Stripe links must use approved HTTPS account hosts; a return URL is never treated as proof of completion', async () => {
  for (const url of ['https://connect.stripe.com/setup/fixture', 'https://dashboard.stripe.com/fixture']) assert.equal(api.stripeAccountUrl(url), url);
  for (const url of [null, 'javascript:alert(1)', '/relative', 'http://connect.stripe.com/setup', 'https://connect.stripe.com.evil.test/',
    'https://evil.test/?stripe.com', 'https://user:pass@connect.stripe.com/', 'https://connect.stripe.com:444/']) assert.throws(() => api.stripeAccountUrl(url));
  const client = { auth: { getSession: async () => session('user') } };
  await assert.rejects(api.requestGuardStripe(client, 'create-guard-dashboard-link', 'user', options(async () => Response.json({ url: 'https://evil.test/' }))));
  const result = api.stripeReturnNotice('https://quickguard.uk/guard/bank-settings?stripe_onboarding=return&source=earnings#setup');
  assert.equal(result.path, '/guard/bank-settings?source=earnings#setup');
  assert.match(result.notice, /Check the current account status/); assert.doesNotMatch(result.notice, /complete|verified|ready/);
  assert.equal(api.stripeReturnNotice('https://quickguard.uk/guard/bank-settings?source=earnings'), null);
});

function render(status, { statusError = '', tab = 'setup', notice = '' } = {}) {
  const react = { ...React, useState: initial => [initial === 'setup' ? tab : initial, () => {}], useEffect: () => {} };
  const settings = { profile: { id: 'guard', fullName: 'Guard Name' }, status, loading: false, refreshing: false,
    error: '', statusError, actionError: '', busyAction: null, requiresLogin: false, load() {}, refresh() {}, openStripe() {} };
  const page = { exports: {} };
  const guidance = { exports: {} }; new Function('exports', compile('lib/customer-guidance.ts'))(guidance.exports);
  new Function('require', 'exports', compile('app/guard/bank-settings/page.tsx', true))(id => {
    if (id === 'react') return react;
    if (id === 'next/navigation') return { useRouter: () => ({ replace() {} }) };
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === '@/hooks/useGuardGuard') return { useGuardGuard: () => ({ loading: false, allowed: true }) };
    if (id === '@/hooks/useGuardPayoutSettings') return { useGuardPayoutSettings: () => settings };
    if (id === '@/lib/guard-payout-settings') return { ...api, stripeReturnNotice: () => ({ notice }) };
    if (id === '@/lib/customer-guidance') return guidance.exports;
    if (id === '@/components/PortalSidebar') return { __esModule: true, default: () => null };
    if (id === '@/app/guard/earnings/BankPayoutTracker') return { __esModule: true, default: ({ guardId }) => React.createElement('section', { 'data-guard-id': guardId }, 'Bank deposits') };
    return require(id);
  }, page.exports);
  return renderToStaticMarkup(React.createElement(page.exports.default));
}

test('unknown status offers retry without fake setup/ready state, while valid states offer the matching Stripe actions', () => {
  const unknown = render(null, { statusError: 'Stripe status unavailable' });
  assert.match(unknown, /Stripe status unavailable/); assert.match(unknown, /Refresh Status/);
  assert.doesNotMatch(unknown, /Set Up Payouts|enabled for payouts|Payout setup not started/);
  const empty = render(notStarted); assert.match(empty, /Set Up Payouts/); assert.doesNotMatch(empty, /Manage Bank Account in Stripe/);
  const enabled = render(ready); assert.match(enabled, /Stripe account enabled for payouts/); assert.match(enabled, /Manage Bank Account in Stripe/);
  assert.doesNotMatch(enabled, /Continue Stripe Setup|Set Up Payouts/);
  const restricted = render({ ...ready, status: 'restricted', requirementsDue: ['individual.id_number'] });
  assert.match(restricted, /needs attention/); assert.match(restricted, /Continue Stripe Setup/);
  assert.doesNotMatch(enabled, /Account Number|Sort Code|Save Changes|Hold All Payouts|Minimum Payout Amount/);
});

test('payout guide explains the two stages, and bank history uses the bank-deposit ledger', () => {
  const guide = render(ready, { tab: 'guide' });
  assert.match(guide, /Job payment release/); assert.match(guide, /Stripe account and bank deposit/);
  assert.match(guide, /support request does not itself stop/); assert.doesNotMatch(guide, /every Friday|1st of each month|1-2 business days/);
  const history = render(ready, { tab: 'history' }); assert.match(history, /data-guard-id="guard"/); assert.match(history, /View job earnings and receipts/);
});
