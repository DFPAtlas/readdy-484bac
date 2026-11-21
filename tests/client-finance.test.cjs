const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', compiled)(module, module.exports, name => name === './ReportPdfButton' ? require('./helpers/enterprise-module.cjs').load('app/client/reports/ReportPdfButton.tsx') : name in mocks ? mocks[name] : require(name));
  return module.exports;
}
const money = load('lib/financeAmounts.ts');
const listing = load('lib/client-job-list.ts', { './client-job-tracker': { TRACKER_FILTER_STATUSES: { completed: ['completed', 'paid_out'] } } });
const finance = load('lib/client-finance.ts', { './client-job-list': listing, './financeAmounts': money });
const payment = (id, amount, status, extra = {}) => ({ id, amount, status, currency: 'gbp', client_id: 'client', job_id: id, created_at: '2026-11-01T12:00:00Z', ...extra });
const ledger = [payment('paid', 275, 'completed'), payment('partial', 92, 'partially_refunded', { refund_amount: 20 }), payment('full-one', 92, 'refunded', { refunded: true, refund_amount: 92 }), payment('full-two', 92, 'refunded', { refunded: true, refund_amount: 92 }), payment('cancelled-pending', 84, 'pending'), payment('deleted-pending', 92, 'pending')];
const records = { transactions: ledger, subscriptionPayments: [payment('sub', 98, 'succeeded', { user_id: 'user' })], payableJobs: [] };
function database(rows = {}, failure) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const q = { select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push(['eq', key, value]); return q; }, in(key, value) { call.filters.push(['in', key, value]); return q; }, order(key, options) { call.orders.push([key, options.ascending]); return q; }, range(first, last) { call.range = [first, last]; return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (failure?.table === table) { if (failure.response instanceof Error) throw failure.response; return failure.response; }
        let data = (rows[table] || []).filter(row => call.filters.every(([method, key, value]) => method === 'in' ? value.includes(row[key]) : row[key] === value));
        data = [...data].sort((a, b) => { for (const [key, asc] of call.orders) { const cmp = String(a[key] || '').localeCompare(String(b[key] || '')); if (cmp) return asc ? cmp : -cmp; } return 0; });
        return { data: data.slice(call.range[0], call.range[1] + 1), error: null };
      }).then(resolve, reject); } };
    return q;
  } };
}

test('the recorded ledger reconciles £551 gross, £204 refunds and £347 net; subscriptions remain separate', () => {
  assert.deepEqual(money.paymentTotals(ledger), { collected: 551, refunded: 204, remaining: 347 });
  assert.deepEqual(money.paymentTotals(records.subscriptionPayments), { collected: 98, refunded: 0, remaining: 98 });
  const summary = finance.clientSpendingSummary(ledger, [], new Date('2026-11-19T12:00:00Z'));
  assert.equal(summary.totalSpend, 551); assert.equal(summary.refundsTotal, 204); assert.equal(summary.netSpend, 347); assert.equal(summary.outstandingAmount, 0);
});

test('partial and legacy refunds respect recorded amounts, cap over-refunds and exclude failed/pending attempts', () => {
  assert.equal(money.paymentAmounts(payment('partial-flag', '92', 'completed', { refunded: true, refund_amount: '20' })).refunded, 20);
  assert.equal(money.paymentAmounts(payment('legacy', 92, 'completed', { refunded: true })).refunded, 92);
  assert.equal(money.paymentAmounts(payment('oversize', 92, 'partially_refunded', { refund_amount: 100 })).refunded, 92);
  assert.equal(money.paymentAmounts(payment('failed', 92, 'failed', { refunded: true, refund_amount: 92 })).refunded, 0);
  assert.equal(finance.paymentRefundLabel(payment('partial', 92, 'completed', { refund_amount: 20 })), 'Partially refunded (£20.00)');
  assert.equal(money.isCollected(null), false);
  assert.deepEqual(money.paymentTotals([payment('penny1', '0.10', 'paid'), payment('penny2', '0.20', 'paid')]), { collected: 0.3, refunded: 0, remaining: 0.3 });
});

test('one current payable booking value per job excludes cancelled/deleted/funded work and duplicate retries', () => {
  const tx = [payment('old', 40, 'pending', { job_id: 'pay', created_at: '2026-11-01' }), payment('new', 50, 'pending', { job_id: 'pay', created_at: '2026-11-02' }), payment('collected', 60, 'paid', { job_id: 'already-paid' })];
  const job = (id, extra = {}) => ({ id, status: 'awaiting_payment', agreed_amount: null, ...extra });
  const jobs = [job('pay'), job('quote', { agreed_amount: 25.1 }), job('cancelled', { status: 'cancelled', agreed_amount: 100 }), job('deleted', { is_deleted: true, agreed_amount: 100 }), job('funded', { payment_status: 'funded', agreed_amount: 100 }), job('already-paid', { agreed_amount: 60 })];
  assert.equal(finance.clientSpendingSummary(tx, jobs).outstandingAmount, 75.1);
  assert.equal(finance.clientSpendingSummary([], [job('unpriced')]).outstandingUnknownJobs, 1);
});

test('selected periods use inclusive UK payment creation dates for both payment sources and lifetime refunds on those payments', () => {
  const rows = [payment('before', 10, 'paid', { created_at: '2026-06-30T22:59:59Z' }), payment('start', 20, 'paid', { created_at: '2026-06-30T23:00:00Z' }), payment('end', 30, 'partially_refunded', { created_at: '2026-07-01T22:59:59Z', refund_amount: 5, refunded_at: '2026-08-01' }), payment('after', 40, 'paid', { created_at: '2026-07-01T23:00:00Z' })];
  const selected = finance.paymentsInRange(rows, { from: '2026-07-01', to: '2026-07-01' });
  assert.deepEqual(selected.map(r => r.id), ['start', 'end']); assert.deepEqual(money.paymentTotals(selected), { collected: 50, refunded: 5, remaining: 45 });
  assert.deepEqual(finance.paymentsInRange(rows, { from: '2026-07-02', to: '2026-07-01' }), []);
});

test('all retained payment pages are owned; deleted-job receipts stay in gross history but payable jobs exclude deleted records', async () => {
  const rows = { transactions: Array.from({ length: 205 }, (_, n) => payment(String(n), 1, 'paid')), subscription_payments: [payment('owned-sub', 98, 'succeeded', { user_id: 'user' }), payment('foreign-sub', 99, 'succeeded', { user_id: 'foreign' })], jobs: [{ id: 'due', client_id: 'client', status: 'awaiting_payment', is_deleted: false }, { id: 'deleted', client_id: 'client', status: 'awaiting_payment', is_deleted: true }] };
  rows.transactions.push(payment('foreign', 1000, 'paid', { client_id: 'foreign' }));
  const db = database(rows); const result = await finance.loadClientFinanceRecords(db, 'client', 'user');
  assert.equal(result.transactions.length, 205); assert.equal(result.subscriptionPayments.length, 1); assert.equal(result.payableJobs.length, 1);
  assert.ok(db.calls.some(c => c.table === 'transactions' && c.range[0] === 200));
  for (const call of db.calls.filter(c => c.table === 'transactions')) { assert.ok(call.filters.some(f => f[1] === 'client_id' && f[2] === 'client')); assert.equal(call.filters.some(f => f[1] === 'is_deleted'), false); }
});

test('failed, malformed and unsupported-currency source rows cannot produce successful zero financial totals', async () => {
  for (const table of ['transactions', 'subscription_payments', 'jobs']) for (const response of [{ data: null, error: { message: 'read failed' } }, { data: null, error: null }, Error('offline')]) await assert.rejects(finance.loadClientFinanceRecords(database({}, { table, response }), 'client', 'user'));
  for (const extra of [{ currency: 'usd' }, { amount: 'invalid' }, { amount: null }, { amount: ' ' }, { refund_amount: 'invalid' }, { created_at: null }, { created_at: 'invalid' }]) await assert.rejects(finance.loadClientFinanceRecords(database({ transactions: [payment('bad', 1, 'paid', extra)] }), 'client', 'user'));
});

test('job payment badges use collected/refund records independently of booking/payout status', () => {
  for (const [transactions, expected] of [[[payment('a', 11, 'completed')], 'Paid'], [[payment('a', 92, 'partially_refunded', { refund_amount: 20 })], 'Partially Refunded'], [[payment('a', 92, 'refunded')], 'Refunded'], [[payment('a', 11, 'failed')], 'Failed']]) assert.equal(finance.clientJobPaymentLabel({ payment_status: 'unpaid', transactions }), expected);
  assert.equal(finance.clientJobPaymentLabel({ payment_status: 'funded', transactions: [] }), 'Funded');
  assert.equal(finance.clientJobPaymentLabel({ payment_status: null, transactions: [] }), 'Payment status unavailable');
});

test('the real history endpoint response preserves the partial-refund badge even when nested refund amounts are omitted', async () => {
  const { loadEndpoint, databaseFixture, sampleRows } = require('./helpers/client-read-fixture.cjs');
  for (const status of ['paid_out', 'cancelled']) {
    const rows = sampleRows(); const job = rows.jobs[0]; job.status = status;
    rows.transactions = [{ ...rows.transactions[0], amount: 92, status: 'partially_refunded', refund_amount: 20 }];
    const response = await loadEndpoint('get-client-job-history', databaseFixture(rows))({ pageSize: 50 });
    assert.equal(response.status, 200);
    const historyJob = response.body.jobs.find(row => row.job_id === job.id);
    assert.equal(historyJob.transactions[0].status, 'partially_refunded');
    assert.equal(finance.clientJobPaymentLabel(historyJob), 'Partially Refunded');
  }
  // This compact API projection is display evidence only. Do not fabricate a
  // refund amount or feed it to the complete recorded-payment summaries.
  assert.equal(finance.clientJobPaymentLabel({ payment_status: 'paid', transactions: [{ amount: 92, status: 'partially_refunded' }] }), 'Partially Refunded');
});

test('shared summary renders identical explicit job/subscription definitions and error states never display zero money', () => {
  const render = state => {
    const Component = load('app/client/components/ClientSpendingSummary.tsx', { '@/hooks/useClientFinance': { useClientFinance: () => ({ ...state, reload() {} }) }, '@/lib/client-finance': finance, '@/lib/financeAmounts': money }).default;
    return renderToStaticMarkup(React.createElement(Component, { subscriptions: true }));
  };
  const html = render({ data: records, loading: false, error: null });
  for (const value of ['£551.00', '£204.00', '£347.00', '£98.00', 'Gross Job Payments', 'Net Job Spend', 'Net Subscription Spend']) assert.ok(html.includes(value), value);
  for (const state of [{ data: null, loading: true }, { data: null, loading: false, error: 'Payment totals could not be loaded.' }]) { const failure = render(state); assert.doesNotMatch(failure, /£0.00|Net Job Spend/); }
  assert.match(render({ data: null, loading: false, error: 'Read failed' }), /Retry payment totals/);
});

test('finance detail renders the same gross/refund/net calculations as the shared summary', () => {
  const Component = load('app/client/reports/FinanceReport.tsx', { '@/lib/financeAmounts': money }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { transactions: ledger, subscriptionPayments: records.subscriptionPayments, client: null, reportRange: {}, onToast() {} }));
  for (const value of ['£551.00', '£204.00', '£347.00', 'Gross Payments', 'Net Spend', 'Partially Refunded']) assert.ok(html.includes(value), value);
});

test('financial refresh ignores superseded and closed-screen responses, exposes errors and recovers on Retry', async () => {
  const slots = [], effects = [], writes = [], pending = []; let cursor = 0;
  const hooks = { useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; writes.push(next); }]; }, useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; }, useCallback(fn) { cursor++; return fn; }, useEffect(fn) { cursor++; if (!effects.length) effects.push(fn); } };
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) }, from() { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'client' }, error: null }) }; return q; } };
  const hook = load('hooks/useClientFinance.ts', { react: hooks, '@/lib/supabase': { supabase: db }, '@/lib/client-finance': { loadClientFinanceRecords: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } }).useClientFinance;
  const render = () => { cursor = 0; return hook(); }; const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
  render(); const cleanup = effects[0](); await flush();
  let api = render(); const newer = api.reload(); await flush(); pending[1].resolve(records); await newer;
  assert.equal(render().data, records); const count = writes.length;
  pending[0].resolve({ transactions: [payment('stale', 999, 'paid')] }); await flush(); assert.equal(writes.length, count); assert.equal(render().data, records);
  api = render(); const failure = api.reload(); await flush(); pending[2].reject(Error('offline')); await failure;
  assert.equal(render().data, null); assert.match(render().error, /could not be loaded/);
  const retry = render().reload(); await flush(); pending[3].resolve(records); await retry; assert.equal(render().error, null); assert.equal(render().data, records);
  const late = render().reload(); await flush(); cleanup(); const closed = writes.length; pending[4].resolve(records); await late; assert.equal(writes.length, closed);
});

test('report financial reads cannot overwrite a newer refresh or a closed screen', async () => {
  const source = fs.readFileSync('app/client/reports/page.tsx', 'utf8');
  const start = source.indexOf('  const loadData = useCallback');
  const body = source.slice(start, source.indexOf('\n  useEffect(', start));
  const setters = [...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => match[1]))];
  const pending = [], writes = [];
  const env = { useCallback: fn => fn, reportRequest: { current: 0 }, reportMounted: { current: true },
    loadClientFinanceRecords: () => new Promise(resolve => pending.push(resolve)), loadClientSupportReport: async () => [],
    supabase: { auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) }, from(table) { const q = { select: () => q, eq: () => q, in: () => q, order: () => q, maybeSingle: async () => ({ data: { id: 'client' } }), then: (resolve, reject) => Promise.resolve({ data: table === 'clients' ? { id: 'client' } : [], error: null }).then(resolve, reject) }; return q; } },
    ...Object.fromEntries(setters.map(name => [name, value => writes.push({ name, value })])),
  };
  const code = ts.transpileModule(body + '\nreturn loadData;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const refresh = new Function(...Object.keys(env), code)(...Object.values(env));
  const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
  const old = refresh(); await flush(); const latest = refresh(); await flush(); pending[1](records); await latest;
  assert.equal(writes.filter(w => w.name === 'setReportData').length, 1);
  const count = writes.length; pending[0]({ transactions: [payment('old', 999, 'paid')], subscriptionPayments: [] }); await old;
  assert.equal(writes.length, count);
  const late = refresh(); await flush(); env.reportMounted.current = false; env.reportRequest.current++; const closed = writes.length; pending[2](records); await late; assert.equal(writes.length, closed);
});
