const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, name => name in mocks ? mocks[name] : require(name), ...Object.values(globals));
  return module.exports;
}
const client = load('lib/client-payment-method.ts');
const checked = (status, billing_link = 'matched') => ({ status: 'checked', result: { status, billing_link, checked_at: '2026-11-19T20:00:00Z' } });
const missing = () => Object.assign(new Error('Provider private message'), { code: 'resource_missing', statusCode: 404 });
function endpoint(options = {}) {
  let handler; const calls = [];
  const profile = { id: 'client', is_active: true, stripe_customer_id: 'cus_Owned', stripe_subscription_id: 'sub_Owned', ...options.profile };
  const records = options.records || [{ stripe_customer_id: 'cus_Owned', stripe_subscription_id: 'sub_Owned' }];
  const db = { auth: { getUser: async token => { calls.push(['auth', token]); return { data: { user: options.authError ? null : { id: 'user' } }, error: options.authError }; } }, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, limit(n) { call.limit = n; return q; },
      async maybeSingle() { if (options.dbError === table) return { error: Error('Private DB detail') }; return { data: table === 'clients' ? options.noProfile ? null : profile : options.closed ? { user_id: 'user' } : null, error: null }; },
      then(resolve, reject) { return Promise.resolve(options.dbError === table ? { error: Error('Private DB detail') } : { data: records, error: null }).then(resolve, reject); },
    }; return q;
  } };
  const customer = { id: 'cus_Owned', livemode: true, metadata: { userId: 'user', clientId: 'client' }, invoice_settings: { default_payment_method: null }, ...options.customer };
  const provider = async (name, value, args) => { calls.push([name, ...args]); if (value instanceof Error) throw value; return value; };
  class Stripe {
    customers = { retrieve: id => provider('customer', options.customerError || customer, [id]), retrieveSource: (id, source) => provider('source', options.source || { id: source, customer: id, object: 'card' }, [id, source]) };
    subscriptions = { retrieve: id => provider('subscription', options.subscriptionError || { id, customer: 'cus_Owned', livemode: true, metadata: {}, ...options.subscription }, [id]) };
    paymentMethods = { list: args => provider('methods', options.methodError || { data: options.methods || [], has_more: false }, [args]) };
  }
  load('supabase/functions/get-client-payment-method-status/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2.45.0': { createClient: () => db },
    'https://esm.sh/stripe@14.10.0?target=deno': { default: Stripe, __esModule: true },
  }, { Deno: { serve(fn) { handler = fn; }, env: { get(name) { return name === 'STRIPE_SECRET_KEY' ? 'sk_live_fixture' : 'server-only-fixture'; } } } });
  return { calls, async run({ token = 'owned-token', method = 'POST', body = {} } = {}) {
    const res = await handler(new Request('https://example.test/status', { method, headers: token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : {}, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
    return { status: res.status, headers: res.headers, body: res.headers.get('Content-Type')?.includes('json') ? await res.json() : await res.text() };
  } };
}

test('actual endpoint rejects anonymous, invalid, closed and non-client accounts before Stripe reads', async () => {
  for (const [options, request, expected] of [[{}, { token: null }, 401], [{ authError: Error('expired') }, {}, 401], [{ closed: true }, {}, 403], [{ noProfile: true }, {}, 403], [{ profile: { is_active: false } }, {}, 403]]) {
    const h = endpoint(options); assert.equal((await h.run(request)).status, expected); assert.equal(h.calls.some(c => Array.isArray(c) && c[0] === 'customer'), false);
  }
  assert.equal((await endpoint().run({ method: 'GET' })).status, 405);
  assert.equal((await endpoint().run({ method: 'OPTIONS' })).status, 200);
});

test('customer creation and historical payments never imply a saved method; requests cannot select another owner', async () => {
  const h = endpoint(); const r = await h.run({ body: { client_id: 'foreign', customer_id: 'cus_Foreign' } });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'none'); assert.equal(r.body.billing_link, 'matched'); assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(h.calls.filter(c => c.table).map(c => [c.table, c.filters]), [['account_closures', [['user_id', 'user']]], ['clients', [['user_id', 'user']]], ['subscriptions', [['user_id', 'user']]]]);
  assert.deepEqual(h.calls.find(c => c[0] === 'methods'), ['methods', { customer: 'cus_Owned', limit: 1 }]);
  assert.equal(h.calls.some(c => c.table === 'transactions'), false);
  assert.deepEqual(Object.keys(r.body).sort(), ['billing_link', 'checked_at', 'status']);
  assert.doesNotMatch(JSON.stringify(r.body), /cus_|sub_|pm_|server-only|userId/);
});

test('no customer and no subscription returns none without provider creation or reads', async () => {
  const h = endpoint({ profile: { stripe_customer_id: null, stripe_subscription_id: null }, records: [] }); const r = await h.run();
  assert.equal(r.body.status, 'none'); assert.equal(r.body.billing_link, 'not_linked'); assert.equal(h.calls.some(c => c[0] === 'customer'), false);
});

test('attached modern methods and valid legacy default sources are verified without returning card data', async () => {
  for (const options of [{ methods: [{ id: 'pm_saved', customer: 'cus_Owned', livemode: true, type: 'card', card: { last4: '4242' } }] }, { customer: { default_source: 'card_legacy' } }]) {
    const r = await endpoint(options).run(); assert.equal(r.body.status, 'saved'); assert.equal(r.body.billing_link, 'matched'); assert.doesNotMatch(JSON.stringify(r.body), /4242|pm_saved|card_legacy/);
  }
});

test('mismatched customers, modes, provider ownership, missing/deleted resources and ambiguous subscriptions never give ready', async () => {
  const cases = [
    { records: [{ stripe_customer_id: 'cus_Other', stripe_subscription_id: 'sub_Owned' }] },
    { profile: { stripe_subscription_id: 'sub_Other' } },
    { records: [{}, {}] }, { customer: { livemode: false } }, { customer: { deleted: true } },
    { customer: { metadata: { userId: 'foreign' } } }, { customerError: missing() },
    { subscription: { customer: 'cus_Other' } }, { subscription: { livemode: false } },
    { subscription: { metadata: { clientId: 'foreign' } } }, { subscriptionError: missing() },
    { profile: { stripe_customer_id: null } },
  ];
  for (const options of cases) {
    const r = await endpoint(options).run(); assert.equal(r.status, 200); assert.equal(r.body.billing_link, 'needs_review'); assert.equal(client.paymentMethodView({ status: 'checked', result: r.body }).complete, false); assert.equal(client.paymentMethodView({ status: 'checked', result: r.body }).canOpenPortal, false);
  }
});

test('read failures and inconsistent method payloads return generic retryable failure, never none', async () => {
  for (const options of [{ dbError: 'clients' }, { dbError: 'subscriptions' }, { dbError: 'account_closures' }, { customerError: Error('secret provider detail') }, { subscriptionError: Error('timeout') }, { methodError: Error('offline') }, { methods: [{ id: 'pm_foreign', customer: 'cus_Foreign', livemode: true }] }, { customer: { invoice_settings: { default_payment_method: 'pm_not_attached' } } }]) {
    const r = await endpoint(options).run(); assert.equal(r.status, 503); assert.equal(r.body.status, undefined); assert.match(r.body.error, /try again/); assert.doesNotMatch(JSON.stringify(r.body), /secret|Private DB|pm_foreign/);
  }
});

test('client loader calls only the owned read function and rejects returned/thrown/malformed results', async () => {
  const calls = []; const good = checked('none').result;
  const db = { functions: { invoke: async (...args) => { calls.push(args); return { data: good, error: null }; } } };
  assert.deepEqual(await client.loadClientPaymentMethod(db), good); assert.deepEqual(calls, [['get-client-payment-method-status', { body: {} }]]);
  for (const response of [{ data: good, error: Error('failed') }, { data: {}, error: null }, { data: { ...good, checked_at: 'bad' }, error: null }, { data: { ...good, status: true }, error: null }]) await assert.rejects(client.loadClientPaymentMethod({ functions: { invoke: async () => response } }));
  await assert.rejects(client.loadClientPaymentMethod({ functions: { invoke: async () => { throw Error('offline'); } } }));
});

function renderSections(state) {
  const status = load('app/client/profile/PaymentMethodStatus.tsx', { 'next/link': { default: props => React.createElement('a', { href: props.href }, props.children), __esModule: true }, '@/lib/client-payment-method': client }).default;
  const mock = { '@/lib/client-notification-preferences': load('lib/client-notification-preferences.ts'), '@/lib/client-payment-method': client, './PaymentMethodStatus': { default: status, __esModule: true }, '@/lib/supabase': { supabase: {} }, 'next/link': { default: props => React.createElement('a', { href: props.href }, props.children), __esModule: true }, '../components/ClientSpendingSummary': { default: () => null, __esModule: true } };
  const Billing = load('app/client/profile/BillingSection.tsx', mock).default;
  const Preferences = load('app/client/profile/PreferencesSection.tsx', mock).default;
  const props = { profile: { stripe_customer_id: 'cus_Exists', client_promo_jobs_remaining: 0 }, paymentMethodState: state, onRefreshPaymentMethod() {}, onMessage() {} };
  const billing = renderToStaticMarkup(React.createElement(Billing, { ...props, subscription: null }));
  const prefs = renderToStaticMarkup(React.createElement(Preferences, { ...props, notifPrefs: null, healthData: { profileComplete: false, billingAdded: false, firstJobPosted: false, notificationsSet: false, documentsUploaded: false } }));
  return { billing, prefs };
}

test('actual billing and health components share none/loading/error/mismatch/saved semantics despite a customer ID', () => {
  for (const state of [{ status: 'loading' }, { status: 'error' }, checked('none'), checked('saved', 'needs_review')]) {
    const html = renderSections(state); assert.doesNotMatch(html.billing, /Card on file/); assert.match(html.prefs, /0\/6 complete/);
    if (state.status !== 'checked' || state.result.billing_link === 'needs_review') assert.match(html.billing, /disabled=""/);
    if (state.status === 'error') assert.match(html.billing, /Retry payment method check/);
    if (state.status === 'checked' && state.result.billing_link === 'needs_review') assert.match(html.prefs, /Billing link needs checking/);
  }
  const ready = renderSections(checked('saved')); assert.match(ready.billing, /Saved payment method/); assert.match(ready.billing, /Manage Payment Method/); assert.match(ready.prefs, /1\/6 complete/);
});

test('actual hook supports error/Retry, portal-return refresh, superseded requests and unmount protection', async () => {
  const states = [], refs = [], effects = [], pending = [], listeners = new Map(); let cursor = 0, refCursor = 0;
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; }, useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; }, useCallback(fn) { return fn; }, useEffect(fn) { effects.push(fn); } };
  const db = { functions: { invoke() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } } };
  const hook = load('hooks/useClientPaymentMethod.ts', { react, '@/lib/supabase': { supabase: db }, '@/lib/client-payment-method': client }, { window: { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } } }).useClientPaymentMethod;
  const render = id => { cursor = 0; refCursor = 0; return hook(id); };
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  let view = render('client'); const cleanup = effects[0](); pending.shift().resolve({ data: null, error: Error('offline') }); await flush();
  view = render('client'); assert.equal(view.state.status, 'error');
  const retry = view.refresh(); pending.shift().resolve({ data: checked('saved').result, error: null }); await retry; assert.equal(render('client').state.result.status, 'saved');
  listeners.get('focus')(); const first = pending.shift(); const secondRun = render('client').refresh(); const second = pending.shift();
  second.resolve({ data: checked('none').result, error: null }); await secondRun; first.resolve({ data: checked('saved').result, error: null }); await flush(); assert.equal(render('client').state.result.status, 'none');
  assert.equal(render('other-client').state.status, 'loading');
  const last = render('client').refresh(); const tail = pending.shift(); cleanup(); tail.resolve({ data: checked('saved').result, error: null }); await last; assert.equal(states[0].state.status, 'loading'); assert.equal(listeners.has('focus'), false);
});

function paymentCentre(state, { portalLoading = false } = {}) {
  const calls = { portal: 0, refresh: 0, opened: [], clientIds: [] };
  const PaymentMethodStatus = load('app/client/profile/PaymentMethodStatus.tsx', {
    'next/link': { default: props => React.createElement('a', { href: props.href }, props.children), __esModule: true },
    '@/lib/client-payment-method': client,
  }).default;
  const noopComponent = { default: () => null, __esModule: true };
  const Page = load('app/client/payment-centre/page.tsx', {
    react: { ...React, useState: initial => [initial, () => {}], useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn },
    'next/link': { default: props => React.createElement('a', { href: props.href }, props.children), __esModule: true },
    '@/lib/client-journey': { paymentLabel: value => value, planLabel: value => value },
    '@/lib/financeAmounts': { isCollected: () => false },
    '@/lib/supabase': { supabase: {} },
    '@/components/PortalSidebar': noopComponent,
    '@/components/LiveIndicator': noopComponent,
    './PaymentDocuments': noopComponent,
    '../profile/PaymentMethodStatus': { default: PaymentMethodStatus, __esModule: true },
    '@/hooks/useClientGuard': { useClientGuard: () => ({ loading: false, allowed: true }) },
    '@/lib/client-payment-method': client,
    '@/hooks/useClientPaymentMethod': { useClientPaymentMethod: id => { calls.clientIds.push(id); return { state, refresh() { calls.refresh++; } }; } },
    '@/hooks/useClientPaymentCentre': { useClientPaymentCentre: () => ({
      loading: false, error: null, clientId: 'owned-client', refetch() {}, exportCsv() {},
      spendingSummary: { thisMonthSpend: 0, totalSpend: 0, jobsPaid: 0, outstandingAmount: 0, outstandingUnknownJobs: 0, refundsTotal: 0, netSpend: 0 },
      billingInfo: { stripeCustomerId: 'cus_Exists', planName: 'Client Starter' }, jobPayments: [], portalLoading,
      async handleBillingPortal() { calls.portal++; return 'https://billing.stripe.com/p/session/fixture'; },
    }) },
  }, { window: { open: (...args) => calls.opened.push(args) } }).default;
  const tree = Page();
  const elements = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!React.isValidElement(node)) return;
    elements.push(node); visit(node.props.children);
  }
  visit(tree);
  const text = node => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : typeof node === 'string' ? node : '';
  const action = elements.find(node => node.type === 'button' && /^(?:(?:Add|Manage) Payment Method|Loading\.\.\.)$/.test(text(node)));
  return { calls, action, status: elements.find(node => node.type === PaymentMethodStatus), html: renderToStaticMarkup(tree) };
}

test('actual Payment Centre never treats a customer ID as a verified card and blocks unsafe portal actions', async () => {
  for (const state of [{ status: 'loading' }, { status: 'error' }, checked('unverified', 'needs_review'), checked('saved', 'needs_review')]) {
    const page = paymentCentre(state);
    assert.deepEqual(page.calls.clientIds, ['owned-client']);
    assert.doesNotMatch(page.html, /Card on file/);
    assert.equal(page.action.props.disabled, true);
    await page.action.props.onClick();
    assert.equal(page.calls.portal, 0); assert.deepEqual(page.calls.opened, []);
    if (state.status === 'loading') assert.match(page.html, /Checking payment method/);
    if (state.status === 'error') {
      assert.match(page.html, /Payment method status unavailable/);
      assert.match(page.html, /Retry payment method check/);
      page.status.props.onRefresh(); assert.equal(page.calls.refresh, 1);
    }
    if (state.status === 'checked') assert.match(page.html, /Billing link needs checking/);
  }
});

test('actual Payment Centre preserves add/manage actions for verified none/saved and guards a busy portal', async () => {
  for (const [state, label] of [[checked('none'), 'Add Payment Method'], [checked('none', 'not_linked'), 'Add Payment Method'], [checked('saved'), 'Manage Payment Method']]) {
    const page = paymentCentre(state);
    assert.equal(page.action.props.disabled, false); assert.match(page.html, new RegExp(label));
    assert.match(page.html, state.result.status === 'saved' ? /Saved payment method/ : /No saved payment method/);
    await page.action.props.onClick(); assert.equal(page.calls.portal, 1);
    assert.deepEqual(page.calls.opened, [['https://billing.stripe.com/p/session/fixture', '_blank']]);
  }
  const busy = paymentCentre(checked('saved'), { portalLoading: true });
  assert.equal(busy.action.props.disabled, true);
  await busy.action.props.onClick();
  assert.equal(busy.calls.portal, 0);
});
