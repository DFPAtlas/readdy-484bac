const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadEndpoint, databaseFixture, sampleRows } = require('./helpers/client-read-fixture.cjs');
function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const resolve = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks, globals);
    if (name.startsWith('.')) {
      const target = path.join(path.dirname(file), name);
      return target.endsWith('.cjs') ? require(path.resolve(target)) : load(target + '.ts', mocks, globals);
    }
    return require(name);
  };
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(mod, mod.exports, resolve, ...Object.values(globals));
  return mod.exports;
}
const completion = load('lib/client-job-completion.ts');
const { clientPaymentTimeline } = load('lib/client-payment-timeline.ts');
const timeline = (data = {}) => Object.fromEntries(clientPaymentTimeline({ paymentStatus: 'pending_payment', releaseStatus: 'pending', jobStatus: 'open', refundStatus: '—', ...data }).map(step => [step.label, step.done]));

test('completion groups match Tracker and exclude archived, cancelled and unapproved work', () => {
  const tracker = load('lib/client-job-tracker.ts');
  assert.deepEqual(completion.CLIENT_COMPLETED_JOB_STATUSES, tracker.TRACKER_FILTER_STATUSES.completed);
  for (const status of Object.keys(tracker.TRACKER_LIFECYCLE)) assert.equal(completion.isCompletedClientJobStatus(status), tracker.trackerLifecycle(status).group === 'completed', status);
});

test('history completion filter, count and paging include paid-out/review states with owned financial details intact', async () => {
  const rows = sampleRows();
  ['completed', 'payout_approved', 'paid_out', 'review_pending', 'closed', 'cancelled', 'awaiting_client_approval'].forEach((status, i) => { rows.jobs[i].status = status; });
  const endpoint = loadEndpoint('get-client-job-history', databaseFixture(rows));
  const result = await endpoint({ status: 'completed', pageSize: 50 });
  assert.equal(result.status, 200);assert.equal(result.body.totalCount, 4);assert.equal(result.body.stats.completed, 4);
  assert.deepEqual(result.body.jobs.map(j => j.job_status), ['review_pending', 'paid_out', 'payout_approved', 'completed']);
  const first = await endpoint({ status: 'completed', pageSize: 2, page: 1 });
  const second = await endpoint({ status: 'completed', pageSize: 2, page: 2 });
  assert.equal(first.body.totalCount, 4);assert.equal(second.body.totalCount, 4);
  assert.deepEqual([...first.body.jobs, ...second.body.jobs].map(j => j.job_id), result.body.jobs.map(j => j.job_id));
  const retained = result.body.jobs.find(j => j.job_status === 'completed');
  assert.equal(retained.refund_amount, 3);assert.equal(retained.transactions[0].amount, 11);
  const closed = await endpoint({ status: 'closed' });assert.equal(closed.body.totalCount, 1);assert.equal(closed.body.stats.completed, 0);
  assert.equal((await endpoint({ status: 'completed', dateFrom: '2026-11-21' })).body.totalCount, 0);
  assert.equal((await endpoint({ status: 'completed', search: 'Job 3' })).body.jobs[0].job_status, 'paid_out');
});

test('timeline follows confirmed financial states, never job closure or failed attempts', () => {
  for (const status of ['pending_payment', 'pending', 'processing', 'failed', 'unpaid', 'not_paid']) {
    const state = timeline({ paymentStatus: status, releaseStatus: 'paid_out', jobStatus: 'closed' });
    for (const step of ['Guard Selected', 'Client Paid', 'Funds Held', 'Funds Released', 'Transfer Paid']) assert.equal(state[step], false, status + ' ' + step);
  }
  const funded = timeline({ paymentStatus: 'succeeded', releaseStatus: 'funded', jobStatus: 'in_progress' });
  assert.equal(funded['Funds Held'], true);assert.equal(funded['Guard Completed'], false);assert.equal(funded['Transfer Paid'], false);
  for (const jobStatus of completion.CLIENT_COMPLETED_JOB_STATUSES) {
    const state = timeline({ paymentStatus: 'completed', releaseStatus: 'funded', jobStatus });
    assert.equal(state['Guard Completed'], true);assert.equal(state['Funds Released'], false);assert.equal(state['Transfer Paid'], false);
  }
  const closed = timeline({ paymentStatus: 'completed', releaseStatus: 'funded', jobStatus: 'closed' });
  assert.equal(closed['Guard Completed'], false);assert.equal(closed['Transfer Paid'], false);
  const released = timeline({ paymentStatus: 'completed', releaseStatus: 'released', jobStatus: 'closed' });
  assert.equal(released['Funds Released'], true);assert.equal(released['Transfer Paid'], false);
  // Reproduces the reviewed £88 QA record: closed job, collected transaction,
  // payment_status=paid_out. Every preceding milestone must be complete.
  assert.ok(Object.values(timeline({ paymentStatus: 'completed', releaseStatus: 'paid_out', jobStatus: 'closed' })).every(Boolean));
});

test('refund completion and requested/processing states remain distinct from payout success', () => {
  for (const paymentStatus of ['refunded', 'partially_refunded']) {
    const state = timeline({ paymentStatus, releaseStatus: paymentStatus, jobStatus: 'cancelled', refundStatus: 'Refunded' });
    assert.equal(state['Client Paid'], true);assert.equal(state.Refunded, true);assert.equal(state['Transfer Paid'], false);
  }
  for (const refundStatus of ['Refund requested', 'Refund processing', 'Refund declined']) {
    assert.equal(timeline({ paymentStatus: 'completed', releaseStatus: 'funded', refundStatus })[refundStatus], false);
  }
});

function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function content(tree) { return Array.isArray(tree) ? tree.map(content).join('') : tree && typeof tree === 'object' ? content(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree); }

test('actual job report filters completed states and exports readable labels without changing CSV totals', async () => {
  let cursor = 0;const states = [];let exported;
  const hooks = { ...React, useState(initial) { const n = cursor++;if (!(n in states)) states[n] = initial;return [states[n], value => { states[n] = value; }]; }, useMemo: fn => fn() };
  const Component = load('app/client/reports/JobHistoryReport.tsx', { react: hooks, 'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) } }, {
    URL: { createObjectURL(blob) { exported = blob;return 'blob:synthetic'; }, revokeObjectURL() {} },
    document: { createElement() { return { click() {} }; } },
  }).default;
  const jobs = ['paid_out', 'completed', 'review_pending', 'payout_approved', 'closed', 'cancelled'].map((status, i) => ({ id: 'job-' + i, job_title: 'Synthetic ' + i, status, venue_city: 'London', start_time: '22:00', end_time: '02:00', hourly_rate: 20, job_assignments: [{ id: 'assignment-' + i }], number_of_guards: 1 }));
  const render = () => { cursor = 0;return Component({ jobs, reportRange: { from: '', to: '' }, onToast() {} }); };
  let tree = render();
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: 'completed' } });
  tree = render();assert.match(content(tree), /4 jobs/);assert.match(content(tree), /£320.00/);
  assert.ok(!nodes(tree).some(n => n.type === 'h3' && ['Synthetic 4', 'Synthetic 5'].includes(content(n))));
  nodes(tree).find(n => n.type === 'button' && content(n).trim() === 'CSV').props.onClick();
  const csv = await exported.text();assert.equal(csv.trim().split('\n').length, 5);
  for (const label of ['Paid Out', 'Completed', 'Review Pending', 'Payout Pending']) assert.ok(csv.includes(label), label);
  assert.ok(!csv.includes('paid_out'));assert.equal((csv.match(/£80.00/g) || []).length, 4);
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: 'closed' } });
  tree = render();assert.match(content(tree), /1 jobs/);assert.match(renderToStaticMarkup(tree), />Closed</);
});
