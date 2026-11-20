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
const links = load('supabase/functions/_shared/payment-document-links.ts');
const client = load('lib/client-payment-documents.ts', { './payment-document-links': load('lib/payment-document-links.ts') });
const T = '00000000-0000-4000-8000-000000000001';
const receipt = 'https://pay.stripe.com/receipts/payment/fixture';
const invoiceURL = 'https://invoice.stripe.com/i/fixture';
const missing = () => Object.assign(Error('PRIVATE_PROVIDER'), { code: 'resource_missing', statusCode: 404 });
function fixture(options = {}) {
  const tx = { id: T, client_id: 'client', job_id: 'job', amount: '92.00', currency: 'gbp', status: 'completed', stripe_session_id: 'cs_live_Owned', stripe_payment_intent: 'pi_Owned', stripe_charge_id: null, stripe_invoice_id: null, ...options.tx };
  const charge = { id: 'ch_Owned', livemode: true, currency: 'gbp', amount: 9200, amount_captured: 9200, captured: true, paid: true, status: 'succeeded', payment_intent: 'pi_Owned', customer: 'cus_Owned', receipt_url: receipt, invoice: null, ...options.charge };
  const pi = { id: 'pi_Owned', status: 'succeeded', livemode: true, amount: 9200, amount_received: 9200, currency: 'gbp', customer: 'cus_Owned', latest_charge: charge, metadata: { clientId: 'client', jobId: 'job', paymentType: 'job_payment' }, ...options.pi };
  const invoice = options.invoice || null;
  const session = { id: 'cs_live_Owned', mode: 'payment', payment_status: 'paid', livemode: true, amount_total: 9200, currency: 'gbp', customer: 'cus_Owned', client_reference_id: 'client', metadata: { clientId: 'client', jobId: 'job', paymentType: 'job_payment' }, payment_intent: pi, invoice, ...options.session };
  return { tx, charge, pi, session, invoice };
}
function endpoint(options = {}) {
  let handler; const calls = [], data = fixture(options);
  const db = { auth: { getUser: async () => ({ data: { user: options.authError ? null : { id: 'user' } }, error: options.authError }) }, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select(fields) { call.fields = fields; return q; }, eq(k, v) { call.filters.push([k, v]); return q; }, async maybeSingle() {
      if (options.dbError === table) return { error: Error('PRIVATE_DB') };
      let row = table === 'clients' ? options.noClient ? null : { id: 'client', is_active: !options.inactive } : table === 'account_closures' ? options.closed ? { user_id: 'user' } : null : options.noTx ? null : data.tx;
      if (row && table === 'transactions' && !call.filters.every(([k, v]) => row[k] === v)) row = null;
      return { data: row, error: null };
    } }; return q;
  } };
  const get = async (name, id, value, args) => { calls.push([name, id, args]); if (options.providerError) throw options.providerError; return value; };
  class Stripe {
    constructor(key) { calls.push(['stripe-key', key]); }
    checkout = { sessions: { retrieve: (id, args) => get('session', id, data.session, args) } };
    paymentIntents = { retrieve: (id, args) => get('pi', id, data.pi, args) };
    charges = { retrieve: id => get('charge', id, data.charge) };
    invoices = { retrieve: id => get('invoice', id, data.invoice) };
  }
  load('supabase/functions/get-client-payment-documents/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2.45.0': { createClient: () => db },
    'https://esm.sh/stripe@14.10.0?target=deno': { default: Stripe, __esModule: true },
    '../_shared/payment-document-links.ts': links,
  }, { Deno: { serve(fn) { handler = fn; }, env: { get(name) { return name === 'STRIPE_SECRET_KEY' ? options.key || 'sk_live_fixture' : 'server-only-fixture'; } } } });
  return { calls, data, async run({ token = 'token', method = 'POST', body = { transaction_id: T } } = {}) {
    const res = await handler(new Request('https://example.test/docs', { method, headers: token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : {}, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
    return { status: res.status, headers: res.headers, body: res.headers.get('Content-Type')?.includes('json') ? await res.json() : await res.text() };
  } };
}

test('actual endpoint authorizes active owned clients and refuses foreign transactions before provider reads', async () => {
  for (const [opts, req, expected] of [[{}, { token: null }, 401], [{ authError: true }, {}, 401], [{ closed: true }, {}, 403], [{ noClient: true }, {}, 403], [{ inactive: true }, {}, 403], [{ noTx: true }, {}, 404], [{ tx: { client_id: 'foreign' } }, {}, 404], [{}, { body: { transaction_id: 'pi_Foreign' } }, 400], [{}, { method: 'GET' }, 405]]) {
    const h = endpoint(opts); assert.equal((await h.run(req)).status, expected); assert.equal(h.calls.some(c => c[0] === 'stripe-key'), false);
  }
  assert.equal((await endpoint().run({ method: 'OPTIONS' })).status, 200);
  const h = endpoint(); await h.run({ body: { transaction_id: T, client_id: 'foreign', session_id: 'cs_live_Foreign', payment_intent_id: 'pi_Foreign' } });
  assert.deepEqual(h.calls.find(c => c.table === 'transactions').filters, [['id', T], ['client_id', 'client']]);
  assert.equal(h.calls.find(c => c[0] === 'session')[1], 'cs_live_Owned');
  assert.equal(h.calls.some(c => c.table === 'jobs'), false); // retained/deleted job payment still belongs to client
});

test('fresh receipts come from the matching paid session/intent/charge, not cached links; invoice absence is explicit', async () => {
  const h = endpoint({ tx: { receipt_url: 'https://evil.test/PRIVATE' } }); const r = await h.run();
  assert.equal(r.status, 200); assert.equal(r.body.status, 'not_issued'); assert.equal(r.body.receipt_url, receipt); assert.equal(r.body.invoice_url, null); assert.equal(r.body.mode, 'live');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(h.calls.find(c => c[0] === 'session')[2], { expand: ['payment_intent.latest_charge', 'invoice'] });
  assert.doesNotMatch(JSON.stringify(r.body), /PRIVATE|cus_|pi_|ch_|cs_|clientId|server-only/);
  assert.deepEqual(Object.keys(r.body).sort(), ['checked_at', 'invoice_pdf', 'invoice_url', 'mode', 'receipt_url', 'status', 'transaction_id']);
});

test('actual invoice links and PDF require the exact paid invoice/payment/customer/mode/amount binding', async () => {
  const invoice = { id: 'in_Owned', status: 'paid', livemode: true, total: 9200, currency: 'gbp', customer: 'cus_Owned', payment_intent: 'pi_Owned', hosted_invoice_url: invoiceURL, invoice_pdf: invoiceURL + '/pdf' };
  const r = await endpoint({ invoice }).run(); assert.equal(r.body.status, 'checked'); assert.equal(r.body.invoice_url, invoiceURL); assert.equal(r.body.invoice_pdf, invoiceURL + '/pdf');
  for (const patch of [{ payment_intent: 'pi_Foreign' }, { customer: 'cus_Foreign' }, { livemode: false }, { total: 9100 }, { currency: 'usd' }, { status: 'open' }, { hosted_invoice_url: 'javascript:alert(1)' }]) {
    const bad = await endpoint({ invoice: { ...invoice, ...patch } }).run(); assert.equal(bad.body.status, 'needs_review'); assert.equal(bad.body.receipt_url, null); assert.equal(bad.body.invoice_url, null);
  }
});

test('crossed session, PI, charge and stored invoice bindings return no document links', async () => {
  for (const opts of [
    { session: { id: 'cs_live_Foreign' } }, { session: { client_reference_id: 'foreign' } }, { session: { metadata: { clientId: 'foreign', jobId: 'job', paymentType: 'job_payment' } } },
    { session: { metadata: { clientId: 'client', jobId: 'other', paymentType: 'job_payment' } } }, { session: { payment_status: 'unpaid' } }, { session: { mode: 'subscription' } }, { session: { amount_total: 9300 } }, { session: { livemode: false } },
    { pi: { id: 'pi_Foreign' } }, { pi: { customer: 'cus_Foreign' } }, { pi: { amount: 9300 } }, { pi: { status: 'processing' } },
    { charge: { amount: 9100 } }, { charge: { amount_captured: 9100 } }, { charge: { customer: 'cus_Foreign' } }, { charge: { payment_intent: 'pi_Foreign' } }, { charge: { paid: false } }, { charge: { livemode: false } }, { charge: { receipt_url: 'https://pay.stripe.com.evil.test/receipt' } },
    { tx: { stripe_charge_id: 'ch_Foreign' } }, { tx: { stripe_invoice_id: 'in_Foreign' } }, { tx: { amount: null } }, { tx: { currency: 'usd' } },
  ]) { const r = await endpoint(opts).run(); assert.equal(r.body.status, 'needs_review', JSON.stringify(opts)); assert.equal(r.body.receipt_url, null); }
});

test('test/live mismatch never retries another mode, infers a live charge or returns unverified cached links', async () => {
  const h = endpoint({ tx: { stripe_session_id: 'cs_test_Owned', receipt_url: receipt } }); const r = await h.run();
  assert.equal(r.body.status, 'different_mode'); assert.equal(r.body.mode, 'test'); assert.equal(r.body.receipt_url, null); assert.equal(h.calls.some(c => c[0] === 'stripe-key'), false);
  const f = fixture(); f.session.id = 'cs_test_Owned'; f.session.livemode = f.pi.livemode = f.charge.livemode = false;
  const testRead = await endpoint({ key: 'sk_test_fixture', tx: { stripe_session_id: 'cs_test_Owned' }, session: f.session }).run(); assert.equal(testRead.body.status, 'not_issued'); assert.equal(testRead.body.mode, 'test');
});

test('legacy intent-only references need explicit owner/job metadata; missing or unpaid references have honest states', async () => {
  const h = endpoint({ tx: { stripe_session_id: null } }); assert.equal((await h.run()).body.receipt_url, receipt); assert.equal(h.calls.some(c => c[0] === 'session'), false);
  assert.equal((await endpoint({ tx: { stripe_session_id: null }, pi: { metadata: {} } }).run()).body.status, 'needs_review');
  for (const status of ['pending', 'failed', 'cancelled']) {
    const h = endpoint({ tx: { status } }); assert.equal((await h.run()).body.status, 'not_paid'); assert.equal(h.calls.some(c => c[0] === 'stripe-key'), false);
  }
  assert.equal((await endpoint({ tx: { stripe_session_id: null, stripe_payment_intent: null } }).run()).body.status, 'not_linked');
});

test('refunded receipts preserve original paid amount and allow recorded full/partial refund histories', async () => {
  for (const [status, amount_refunded] of [['refunded', 9200], ['partially_refunded', 2000]]) {
    const r = await endpoint({ tx: { status }, charge: { amount_refunded } }).run(); assert.equal(r.body.receipt_url, receipt); assert.equal(r.body.status, 'not_issued');
  }
});

test('provider missing is explicit; DB/auth infrastructure/network failures are generic Retry errors', async () => {
  const missingRow = await endpoint({ providerError: missing() }).run(); assert.equal(missingRow.body.status, 'not_found'); assert.equal(missingRow.body.receipt_url, null);
  for (const opts of [{ providerError: Error('PRIVATE_PROVIDER') }, { dbError: 'transactions' }, { dbError: 'clients' }, { dbError: 'account_closures' }, { key: 'invalid' }]) {
    const r = await endpoint(opts).run(); assert.equal(r.status, 503); assert.match(r.body.error, /try again/); assert.doesNotMatch(JSON.stringify(r.body), /PRIVATE|server-only/);
  }
});

test('link allowlist rejects executable, credential, cross-host, lookalike and non-HTTPS URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,evil', 'http://pay.stripe.com/receipt', 'https://pay.stripe.com.evil.test/receipt', 'https://evil.test/receipt', 'https://user:pass@pay.stripe.com/receipt', 'https://pay.stripe.com:8443/receipt', null]) assert.equal(links.paymentDocumentLink(value, 'receipt'), null);
  assert.equal(links.paymentDocumentLink(receipt, 'receipt'), receipt); assert.equal(links.paymentDocumentLink(invoiceURL, 'invoice'), invoiceURL);
});

test('client invokes only the owned transaction endpoint and rejects session changes, malformed and unverified results', async () => {
  const good = (await endpoint().run()).body, calls = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, functions: { invoke: async (...args) => { calls.push(args); return { data: good }; } } };
  assert.deepEqual(await client.loadClientPaymentDocuments(db, T), good); assert.deepEqual(calls, [['get-client-payment-documents', { body: { transaction_id: T } }]]);
  for (const data of [{}, { ...good, transaction_id: 'foreign' }, { ...good, mode: 'bad' }, { ...good, checked_at: 'bad' }, { ...good, receipt_url: 'https://evil.test/receipt' }, { ...good, status: 'different_mode' }]) await assert.rejects(client.loadClientPaymentDocuments({ ...db, functions: { invoke: async () => ({ data }) } }, T));
  let n = 0; await assert.rejects(client.loadClientPaymentDocuments({ ...db, auth: { getUser: async () => ({ data: { user: { id: ++n === 1 ? 'user' : 'other' } } }) } }, T), /Session changed/);
  await assert.rejects(client.loadClientPaymentDocuments({ ...db, functions: { invoke: async () => { throw Error('offline'); } } }, T));
});

const payment = { id: T, receiptUrl: receipt, invoiceUrl: null, documentMode: 'test' };
const moduleMocks = { '@/lib/supabase': { supabase: {} }, '@/lib/client-payment-documents': client, 'next/link': { __esModule: true, default: p => React.createElement('a', p, p.children) } };
test('actual document row labels saved test receipts and invoice absence without promising pending issuance', async () => {
  const { PaymentDocumentsView: View } = load('app/client/payment-centre/PaymentDocuments.tsx', moduleMocks);
  const render = state => renderToStaticMarkup(React.createElement(View, { payment, state, onCheck() {} }));
  const initial = render({ status: 'idle' }); assert.match(initial, /Test payment — not a live charge/); assert.match(initial, /Saved test receipt/); assert.match(initial, /No saved invoice/); assert.doesNotMatch(initial, /Receipt pending|Not available/);
  assert.match(render({ status: 'loading' }), /disabled=""/); assert.match(render({ status: 'error' }), /Retry document check/);
  const good = (await endpoint().run()).body; const fresh = render({ status: 'checked', result: good }); assert.match(fresh, /No Stripe invoice issued/); assert.doesNotMatch(fresh, /Saved test receipt/);
  assert.doesNotMatch(render({ status: 'checked', result: { ...good, status: 'needs_review', receipt_url: null } }), /href="https:\/\/pay.stripe.com/);
  const mismatch = render({ status: 'checked', result: { ...good, status: 'different_mode', mode: 'test', receipt_url: null } }); assert.match(mismatch, /Saved test receipt/); assert.match(mismatch, /Saved links may expire/);
  assert.doesNotMatch(render({ status: 'blocked' }), /href="https:\/\//);
});

test('actual document row handles failure/Retry, superseded responses, sign-out and unmount without stale links', async () => {
  const states = [], refs = [], effects = [], pending = []; let cursor = 0, refCursor = 0, listener, unsubscribed = false;
  const react = { ...React, useCallback(fn) { return fn; }, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = v; }]; }, useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; }, useEffect(fn) { effects.push(fn); } };
  const Component = load('app/client/payment-centre/PaymentDocuments.tsx', { ...moduleMocks, react, '@/lib/supabase': { supabase: { auth: { onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; } } } }, '@/lib/client-payment-documents': { ...client, loadClientPaymentDocuments: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } }).default;
  const render = () => { cursor = refCursor = 0; return Component({ payment }); };
  const view = render(); const cleanup = effects[0]();
  const failed = view.props.onCheck(); pending.shift().reject(Error('offline')); await failed; assert.equal(render().props.state.status, 'error');
  const good = (await endpoint().run()).body;
  const retry = render().props.onCheck(); pending.shift().resolve(good); await retry; assert.equal(render().props.state.result.receipt_url, receipt);
  const old = render().props.onCheck(), first = pending.shift(); const newer = render().props.onCheck(), second = pending.shift(); second.resolve({ ...good, receipt_url: null }); await newer; first.resolve(good); await old; assert.equal(render().props.state.result.receipt_url, null);
  const logout = render().props.onCheck(), tail = pending.shift(); listener('SIGNED_OUT'); tail.resolve(good); await logout; assert.equal(render().props.state.status, 'blocked');
  const stopped = render().props.onCheck(), last = pending.shift(); cleanup(); const before = states[0]; last.resolve(good); await stopped; assert.equal(states[0], before); assert.equal(unsubscribed, true);
});
