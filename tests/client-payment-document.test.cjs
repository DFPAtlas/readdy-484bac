const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = name => {
    if (!name.startsWith('@/')) return require(name);
    const base = path.join(process.cwd(), name.slice(2));
    return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
  };
  new Function('module', 'exports', 'require', output)(mod, mod.exports, localRequire);
  cache.set(file, mod.exports);
  return mod.exports;
}
const { buildClientPaymentRecord, buildClientPaymentEstimate, loadClientPaymentRecord, paymentDocumentHTML } = load('lib/payments/clientPaymentDocument.ts');
const { PaymentDocument } = load('app/client/components/PaymentRecordPreview.tsx');
const InvoicePreview = load('app/client/jobs/[id]/payment/InvoicePreview.tsx').default;
const client = { id: 'client-test', company_name: 'Test Client', email: 'client@example.invalid' };
const job = { id: 'job-test', job_title: 'Synthetic overnight job' };
const payment = {
  id: 'transaction-test', client_id: client.id, job_id: job.id, amount: '11.00', currency: 'GBP',
  status: 'completed', payment_status: 'completed', payment_method: 'stripe',
  created_at: '2026-10-09T08:16:44Z', completed_at: '2026-10-09T08:18:11Z',
};
const detail = (record, label) => record.details.find(row => row.label === label)?.value;
const amount = (record, label) => record.amounts.find(row => row.label === label)?.value;

test('£11 paid transaction stays £11 with its recorded status and dates, regardless of job repricing', () => {
  const record = buildClientPaymentRecord(payment, client, { ...job, hourly_rate: 900, number_of_guards: 20, start_date: '2030-01-01', end_date: '2030-01-05' });
  assert.equal(amount(record, 'Recorded transaction amount'), '£11.00');
  assert.equal(detail(record, 'Status'), 'Paid');
  assert.match(detail(record, 'Payment date'), /9 Oct 2026.*09:18.*BST/);
  assert.match(detail(record, 'Transaction created'), /9 Oct 2026/);
  assert.equal(record.reference, payment.id);
  assert.equal(record.amounts.length, 1);
  assert.equal(record.details.some(row => /due|invoice date/i.test(row.label)), false);
});

test('pending, failed, cancelled and unknown payments are not represented as paid', () => {
  for (const [status, expected] of [['pending', 'Pending'], ['processing', 'Pending'], ['failed', 'Failed'], ['cancelled', 'Cancelled'], ['unexpected', 'Status not recorded']]) {
    const record = buildClientPaymentRecord({ ...payment, status, payment_status: null, completed_at: null }, client, job);
    assert.equal(detail(record, 'Status'), expected);
    assert.equal(detail(record, 'Payment date'), undefined);
  }
});

test('full and partial refunds retain the original payment and actual refund separately', () => {
  for (const [refund, expected] of [[11, 'Refunded'], [3, 'Partially refunded']]) {
    const record = buildClientPaymentRecord({ ...payment, status: refund === 11 ? 'refunded' : 'partially_refunded', refund_amount: refund, refunded_at: '2026-10-10T10:00:00Z' }, client, job);
    assert.equal(detail(record, 'Status'), expected);
    assert.equal(amount(record, 'Recorded transaction amount'), '£11.00');
    assert.equal(amount(record, 'Refunded amount'), `£${refund.toFixed(2)}`);
    assert.match(detail(record, 'Refund date'), /10 Oct 2026/);
  }
  const unknownRefund = buildClientPaymentRecord({ ...payment, refunded: true, refund_amount: null }, client, job);
  assert.equal(detail(unknownRefund, 'Status'), 'Refunded');
  assert.equal(amount(unknownRefund, 'Refunded amount'), 'Not recorded');
  assert.equal(detail(buildClientPaymentRecord({ ...payment, status: 'disputed' }, client, job), 'Status'), 'Disputed');
});

test('missing facts are not replaced with today, a bank transfer or a made-up payment', () => {
  const record = buildClientPaymentRecord({ ...payment, completed_at: null, created_at: null, payment_method: null }, client, job);
  assert.equal(detail(record, 'Payment date'), 'Not recorded');
  assert.equal(detail(record, 'Transaction created'), 'Not recorded');
  assert.equal(detail(record, 'Payment method'), 'Not recorded');
  const processed = buildClientPaymentRecord({ ...payment, completed_at: null, processed_at: '2026-01-02T12:30:00Z' }, client, job);
  assert.match(detail(processed, 'Payment date'), /2 Jan 2026.*12:30.*GMT/);
});

test('invalid amounts, refunds and owner/job mismatches fail closed', () => {
  for (const invalid of [null, undefined, '', 'bad', -1, NaN, Infinity, true]) {
    assert.throws(() => buildClientPaymentRecord({ ...payment, amount: invalid }, client, job), /amount/);
  }
  assert.throws(() => buildClientPaymentRecord({ ...payment, refund_amount: 12 }, client, job), /refund exceeds/);
  assert.throws(() => buildClientPaymentRecord({ ...payment, client_id: 'other' }, client, job), /does not belong/);
  assert.throws(() => buildClientPaymentRecord({ ...payment, job_id: 'other' }, client, job), /does not belong/);
  assert.throws(() => buildClientPaymentRecord({ ...payment, currency: '<GBP>' }, client, job), /currency/);
  assert.equal(amount(buildClientPaymentRecord({ ...payment, currency: null }, client, job), 'Recorded transaction amount'), '£11.00');
  assert.match(amount(buildClientPaymentRecord({ ...payment, currency: 'usd' }, client, job), 'Recorded transaction amount'), /11\.00/);
});

test('screen, downloadable HTML and printable HTML share one escaped document', () => {
  const hostile = '<script>alert("test")</script><img src=x onerror=alert(1)>';
  const record = buildClientPaymentRecord({ ...payment, payment_method: hostile }, { ...client, company_name: hostile }, { ...job, job_title: hostile });
  const markup = renderToStaticMarkup(React.createElement(PaymentDocument, { record }));
  const exported = paymentDocumentHTML(markup);
  assert.ok(exported.includes(markup));
  assert.ok(exported.startsWith('<!DOCTYPE html>'));
  assert.ok(exported.includes('&lt;script&gt;'));
  assert.doesNotMatch(exported, /<script>|<img|13\.20|12345678|20-00-00|Barclays|Awaiting Payment|Total Due|Due Date/);
  assert.match(exported, /£11\.00/);
  assert.match(exported, />Paid</);
});

test('job payment page uses the same transaction record and fails closed without settled records', () => {
  const props = { client, job, costs: { guardFees: 1000, serviceFee: 100, vat: 220, total: 1320 }, onClose() {}, guards: [], invoiceNumber: 'invented' };
  const html = renderToStaticMarkup(React.createElement(InvoicePreview, { ...props, transaction: payment, paymentStatus: 'paid' }));
  assert.match(html, /£11\.00/);
  assert.doesNotMatch(html, /1,320|invented|Due Date/);
  const missing = renderToStaticMarkup(React.createElement(InvoicePreview, { ...props, paymentStatus: 'paid' }));
  assert.match(missing, /recorded payment could not be loaded/);
  assert.doesNotMatch(missing, /Payment estimate/);
  const estimate = buildClientPaymentEstimate(client, job, { guardFees: 10, serviceFee: 1, vat: 0, total: 11 });
  assert.equal(estimate.title, 'Payment estimate');
  assert.equal(amount(estimate, 'Estimated total'), '£11.00');
  assert.equal(estimate.details.some(row => /due|paid/i.test(row.value)), false);
});

function databaseMock(results = {}, users = ['user-test']) {
  const calls = [];
  let authCalls = 0;
  const data = { clients: client, transactions: payment, jobs: job };
  return {
    calls,
    auth: { async getUser() { const id = users[Math.min(authCalls++, users.length - 1)]; return { data: { user: id ? { id } : null }, error: null }; } },
    from(table) {
      const call = { table, filters: [], select: null }; calls.push(call);
      const query = {
        select(value) { call.select = value; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        async maybeSingle() { return table in results ? results[table] : { data: data[table], error: null }; },
      };
      return query;
    },
  };
}

test('record loader authenticates and scopes transaction/job reads to the current client', async () => {
  const database = databaseMock();
  const record = await loadClientPaymentRecord(database, payment.id);
  assert.equal(record.reference, payment.id);
  assert.deepEqual(database.calls.map(call => call.filters), [
    [['user_id', 'user-test']], [['id', payment.id], ['client_id', client.id]], [['id', job.id], ['client_id', client.id]],
  ]);
  assert.equal(database.calls.some(call => /guards|job_assignments/.test(call.select)), false);
});

test('record loader rejects signed-out users, failed/missing reads and account changes', async () => {
  await assert.rejects(loadClientPaymentRecord(databaseMock({}, [null]), payment.id), /sign in again/);
  for (const table of ['clients', 'transactions', 'jobs']) {
    for (const result of [{ data: null, error: null }, { data: null, error: { message: 'denied' } }]) {
      await assert.rejects(loadClientPaymentRecord(databaseMock({ [table]: result }), payment.id));
    }
  }
  await assert.rejects(loadClientPaymentRecord(databaseMock({}, ['first-user', 'second-user']), payment.id), /sign-in changed/);
});

test('payment history ignores superseded previews, unmounted results and late failures', async () => {
  const source = fs.readFileSync('app/client/payment-history/page.tsx', 'utf8');
  const body = source.slice(source.indexOf('  const handleDownloadInvoice ='), source.indexOf('  const handleSendInvoiceEmail'));
  const waiting = [], updates = [];
  const env = {
    useCallback: fn => fn, invoiceRequestRef: { current: 0 }, authRequestRef: { current: 1 }, mountedRef: { current: true }, supabase: {},
    loadClientPaymentRecord: () => new Promise((resolve, reject) => waiting.push({ resolve, reject })),
    setInvoiceLoading: value => updates.push(['loading', value]), setShowInvoicePreview: value => updates.push(['show', value]),
    setInvoiceData: value => updates.push(['record', value]), setEmailToast: value => updates.push(['error', value]),
  };
  const js = ts.transpileModule(body + '\nreturn handleDownloadInvoice;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const handler = new Function(...Object.keys(env), js)(...Object.values(env));
  const first = handler({ id: 'first' }), second = handler({ id: 'second' });
  waiting[1].resolve({ reference: 'second' }); await second;
  const count = updates.length;
  waiting[0].reject(new Error('old request')); await first;
  assert.equal(updates.length, count);
  assert.ok(updates.some(([key, value]) => key === 'record' && value?.reference === 'second'));
  const third = handler({ id: 'third' }); env.mountedRef.current = false;
  const beforeUnmounted = updates.length; waiting[2].resolve({ reference: 'third' }); await third;
  assert.equal(updates.length, beforeUnmounted);
  env.mountedRef.current = true;
  const fourth = handler({ id: 'fourth' }); env.authRequestRef.current++;
  const beforeAuthChange = updates.length; waiting[3].resolve({ reference: 'fourth' }); await fourth;
  assert.equal(updates.length, beforeAuthChange);
});
