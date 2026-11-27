const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content, childMocks, flush } = require('./helpers/guard-ui-fixture.cjs');
const { loadClientActivityRows, filterClientActivity, clientActivitySummary } = load('lib/client-activity-read.ts');
const { loadGuardDashboardSummary } = load('lib/guard-dashboard-summary.ts');
const event = (id, extra = {}) => ({ id, client_id: 'client', action_type: 'job_posted', category: 'job', action_description: 'Synthetic shift ' + id, created_at: '2026-10-05T12:00:00Z', related_job_id: 'job', ...extra });
const payout = (id, extra = {}) => ({ id, guard_id: 'guard', status: 'paid_out', amount: 80, net_amount: 80, created_at: '2026-10-05T12:00:00Z', ...extra });
function database(rows = {}) {
  const db = { rows: { clients: [{ id: 'client', user_id: 'owner', company_name: 'Synthetic Client' }], jobs: [], ...rows }, calls: [], owner: 'owner', failure: null, nextUser: null, listener: null,
    auth: { async getUser() { const id = db.nextUser ? db.nextUser() : db.owner; return { data: { user: id ? { id } : null }, error: null }; }, onAuthStateChange(fn) { db.listener = fn; return { data: { subscription: { unsubscribe() { db.unsubscribed = true; } } } }; } },
    from(table) {
      const call = { table, filters: [], orders: [] }; db.calls.push(call);
      const q = { select(fields, options) { call.fields = fields; call.options = options; return q; }, eq(k, v) { call.filters.push([k, v]); return q; }, order(k, v) { call.orders.push([k, v.ascending]); return q; }, range(a, b) { call.range = [a, b]; return q; }, maybeSingle() { call.single = true; return q; },
        then(resolve, reject) { return Promise.resolve().then(async () => {
          if (db.beforeRead) await db.beforeRead(call);
          if (db.failure === table || (db.failOffset !== undefined && db.failOffset === call.range?.[0] && table !== 'clients')) return { data: null, count: null, error: { message: 'unavailable' } };
          let data = (db.rows[table] || []).filter(row => call.filters.every(([k, v]) => row[k] === v));
          data = [...data].sort((a, b) => { for (const [k, asc] of call.orders) { const c = String(a[k]).localeCompare(String(b[k])); if (c) return asc ? c : -c; } return 0; });
          const count = data.length;
          if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
          return { data: call.options?.head ? null : call.single ? data[0] || null : data, count: db.badCount ? null : count, error: null };
        }).then(resolve, reject); } };
      return q;
    } };
  return db;
}

test('client totals include historical activity across all pages and never another client', async () => {
  const db = database({ client_activity_log: Array.from({ length: 405 }, (_, i) => event('e' + String(i).padStart(3, '0'))).concat(event('foreign', { client_id: 'other' })) });
  const rows = await loadClientActivityRows(db, 'client');
  assert.equal(rows.length, 405);
  assert.equal(clientActivitySummary(rows, new Date('2026-11-27T12:00:00Z')).total, 405);
  assert.equal(clientActivitySummary(rows, new Date('2026-11-27T12:00:00Z')).today, 0);
  assert.deepEqual(db.calls.map(c => c.range), [[0, 199], [200, 399], [400, 599]]);
  assert.ok(db.calls.every(c => c.filters.some(([k, v]) => k === 'client_id' && v === 'client')));
  assert.ok(db.calls.every(c => c.orders.length === 2));
});

test('client search, category, action, related job and date filters share the same counter rows', () => {
  const rows = [event('old'), event('selected', { category: 'payment', action_type: 'payment_made', action_description: 'Receipt for shift', created_at: '2026-07-01T12:00:00Z' }), event('foreign-job', { related_job_id: 'another' })];
  const selected = filterClientActivity(rows, { search: 'receipt', category: 'payment', action: 'payment_made', jobId: 'job', from: '2026-07-01', to: '2026-07-01' });
  assert.deepEqual(selected.map(r => r.id), ['selected']);
  const summary = clientActivitySummary(selected, new Date('2026-07-01T15:00:00Z'));
  assert.deepEqual(summary, { total: 1, today: 1, thisWeek: 1, jobsUpdated: 0, paymentsUpdated: 1, supportUpdates: 0 });
  assert.equal(filterClientActivity(rows, { from: '2026-07-02', to: '2026-07-01' }).length, 0);
});

test('activity day boundaries use UK summer time, inclusive end dates and calendar days', () => {
  const rows = ['2026-06-30T22:59:59Z', '2026-06-30T23:00:00Z', '2026-07-01T22:59:59Z', '2026-07-01T23:00:00Z'].map((created_at, i) => event(String(i), { created_at }));
  assert.deepEqual(filterClientActivity(rows, { from: '2026-07-01', to: '2026-07-01' }).map(r => r.id), ['1', '2']);
  assert.equal(clientActivitySummary(rows, new Date('2026-07-01T12:00:00Z')).today, 2);
  const week = [event('before', { created_at: '2026-06-24T22:59:59Z' }), event('first', { created_at: '2026-06-24T23:00:00Z' }), event('last', { created_at: '2026-07-01T22:59:59Z' }), event('future', { created_at: '2026-07-01T23:00:00Z' })];
  assert.equal(clientActivitySummary(week, new Date('2026-07-01T12:00:00Z')).thisWeek, 2);
});

test('client page failures and duplicate or malformed data fail instead of becoming zero', async () => {
  const db = database({ client_activity_log: Array.from({ length: 205 }, (_, i) => event(String(i))) }); db.failOffset = 200;
  await assert.rejects(loadClientActivityRows(db, 'client'));
  for (const rows of [[event('same'), event('same')], [event('bad', { created_at: 'invalid' })], [event('bad', { category: null })]]) {
    await assert.rejects(loadClientActivityRows(database({ client_activity_log: rows }), 'client'));
  }
});

test('guard completed totals use exact owned assignment counts; earnings preserve retained receipts and zero net', async () => {
  const db = database({ job_assignments: Array.from({ length: 1405 }, (_, i) => ({ id: 'a' + i, guard_id: 'guard', status: 'completed' })).concat({ id: 'foreign', guard_id: 'other', status: 'completed' }),
    guard_payouts: [payout('first', { amount: 100, net_amount: 0 }), payout('second', { amount: '90', net_amount: '80' }), payout('third', { status: 'processing', net_amount: 20 }), payout('excluded', { status: 'refunded' }), payout('foreign', { guard_id: 'other' })] });
  const summary = await loadGuardDashboardSummary(db, 'guard');
  assert.equal(summary.completed, 1405); assert.equal(summary.earned, 80); assert.equal(summary.pending, 20);
  assert.equal(summary.recentPayouts.length, 2);
  assert.deepEqual(db.calls[0].options, { count: 'exact', head: true });
  assert.ok(db.calls.every(c => c.filters.some(([k, v]) => k === 'guard_id' && v === 'guard')));
});

test('guard payout totals paginate beyond database defaults and round in pence', async () => {
  const db = database({ guard_payouts: Array.from({ length: 405 }, (_, i) => payout(String(i), { net_amount: 0.1 })) });
  const summary = await loadGuardDashboardSummary(db, 'guard');
  assert.equal(summary.earned, 40.5); assert.equal(summary.recentPayouts.length, 7);
  assert.deepEqual(db.calls.filter(c => c.table === 'guard_payouts').map(c => c.range), [[0, 199], [200, 399], [400, 599]]);
});

test('guard failures and invalid totals never fall back to a stale profile or partial payout sum', async () => {
  for (const table of ['job_assignments', 'guard_payouts']) {
    const db = database(); db.failure = table; await assert.rejects(loadGuardDashboardSummary(db, 'guard'));
  }
  const missingCount = database(); missingCount.badCount = true; await assert.rejects(loadGuardDashboardSummary(missingCount, 'guard'));
  for (const value of [null, '', 'not-money', -1]) await assert.rejects(loadGuardDashboardSummary(database({ guard_payouts: [payout('bad', { amount: value, net_amount: value })] }), 'guard'));
});

function clientUi(db) {
  const window = { addEventListener() {}, removeEventListener() {} };
  const h = hooksHarness('app/client/activity-log/ActivityLogClient.tsx', { ...childMocks,
    '@/lib/supabase': { supabase: db }, '@/hooks/useClientGuard': { useClientGuard: () => ({ loading: false, allowed: true }) },
    'next/navigation': { useSearchParams: () => new URLSearchParams() },
  }, { window, setTimeout, clearTimeout });
  const outer = h.render();
  const component = nodes(outer).find(n => typeof n.type === 'function').type;
  return { h, render: () => h.renderComponent(component) };
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && content(n).trim() === label);

test('actual client page loads more without resetting; exports and filters use every matching row', async () => {
  const db = database({ client_activity_log: Array.from({ length: 55 }, (_, i) => event(String(i))) });
  const f = clientUi(db); f.render(); await f.h.effects(); let tree = f.render(); await flush(); tree = f.render();
  assert.match(content(tree), /55Total Events/); assert.match(content(tree), /Showing 25 of 55/);
  button(tree, 'Load More').props.onClick(); tree = f.render(); await f.h.effects(); tree = f.render();
  assert.match(content(tree), /Showing 50 of 55/);
  button(tree, 'Export').props.onClick(); tree = f.render();
  const exportModal = nodes(tree).find(n => n.props?.activities);
  assert.equal(exportModal.props.activities.length, 55);
  button(tree, 'Filters').props.onClick(); tree = f.render();
  const filters = nodes(tree).find(n => n.props?.onSearchChange);
  filters.props.onSearchChange('shift 54'); tree = f.render(); await f.h.effects(); tree = f.render();
  assert.match(content(tree), /1Total Events/); assert.match(content(tree), /Showing 1 of 1/);
  assert.equal(db.calls.filter(c => c.table === 'client_activity_log').length, 1);
  f.h.unmount();
});

test('actual client page exposes read failures, retries, and rejects a changed owner', async () => {
  const db = database({ client_activity_log: [event('one')] }); db.failure = 'client_activity_log';
  const f = clientUi(db); f.render(); await f.h.effects(); let tree = f.render();
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert')); assert.doesNotMatch(content(tree), /No activity found/);
  db.failure = null; button(tree, 'Retry activity').props.onClick(); await flush(); tree = f.render();
  assert.match(content(tree), /1Total Events/);
  let authReads = 0; db.nextUser = () => ++authReads === 1 ? 'owner' : 'another';
  button(tree, 'Refresh activity').props.onClick(); await flush(); tree = f.render();
  assert.match(content(tree), /Your session changed/); assert.doesNotMatch(content(tree), /Synthetic shift one/);
  f.h.unmount();
});

test('guard earnings panel shows record totals and unavailable states without cached profile values', () => {
  const h = hooksHarness('app/guard/dashboard/EarningsMiniPanel.tsx', childMocks);
  const summary = { completed: 4, earned: 250, pending: 0, recentPayouts: [{ amount: 80 }] };
  let tree = h.render({ summary, assignments: [] });
  assert.match(content(tree), /£250.00/); assert.match(content(tree), /Completed4/);
  tree = h.render({ summary: null, assignments: [] });
  assert.match(content(tree), /totals unavailable/); assert.doesNotMatch(content(tree), /£0.00/);
  h.unmount();
});

test('guard summary loader rejects superseded reads and results after sign-out, then recovers on retry', async () => {
  const fs = require('node:fs');
  const ts = require('typescript');
  const source = fs.readFileSync('app/guard/dashboard/GuardDashboardClient.tsx', 'utf8');
  const scope = source.slice(source.indexOf('  const readScopeRef ='), source.indexOf('  const traceLog'));
  const body = source.slice(source.indexOf('  const loadGuardSummary ='), source.indexOf('  const loadUserEntitlement ='));
  const reads = [], updates = [];
  let errors = [];
  const db = database({ guards: [{ id: 'guard', user_id: 'owner' }] });
  const env = { useRef: current => ({ current }), useCallback: fn => fn, supabase: db,
    loadGuardDashboardSummary: () => new Promise((resolve, reject) => reads.push({ resolve, reject })),
    setGuardSummary: value => updates.push(value), setDataErrors: fn => { errors = fn(errors); } };
  const code = ts.transpileModule(scope + body + '\nreturn { readScopeRef, loadGuardSummary };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const api = new Function(...Object.keys(env), code)(...Object.values(env));
  Object.assign(api.readScopeRef.current, { active: true, userId: 'owner' });
  const old = api.loadGuardSummary('owner'); await flush();
  const fresh = api.loadGuardSummary('owner'); await flush();
  const summary = { completed: 4, earned: 250, pending: 0, recentPayouts: [] };
  reads[1].resolve(summary); await fresh; assert.equal(updates.at(-1), summary);
  const writes = updates.length; reads[0].resolve({ completed: 99 }); await old; assert.equal(updates.length, writes);
  const failing = api.loadGuardSummary('owner'); await flush(); reads[2].reject(Error('offline')); await failing;
  assert.equal(updates.at(-1), null); assert.deepEqual(errors, ['activity_totals']);
  const retry = api.loadGuardSummary('owner'); await flush(); reads[3].resolve(summary); await retry; assert.deepEqual(errors, []);
  const closing = api.loadGuardSummary('owner'); await flush();
  api.readScopeRef.current.active = false; api.readScopeRef.current.epoch++;
  const atClose = updates.length; reads[4].resolve(summary); await closing; assert.equal(updates.length, atClose);
  await api.loadGuardSummary('someone-else'); assert.equal(reads.length, 5);
});

test('profile Jobs Done uses the same verified total instead of a cached profile zero', () => {
  const h = hooksHarness('app/guard/dashboard/ProfileHeroCard.tsx', childMocks);
  const guard = { id: 'guard', full_name: 'Synthetic Guard', total_jobs_completed: 0 };
  const tree = h.render({ guard, completedShifts: 4 });
  assert.match(content(tree), /Jobs Done4/);
  assert.match(content(h.render({ guard, completedShifts: null })), /Jobs Done—/);
  h.unmount();
});

test('available job total is the exact count, independent of the twelve loaded cards', async () => {
  const fs = require('node:fs'); const ts = require('typescript');
  const source = fs.readFileSync('app/guard/dashboard/GuardDashboardClient.tsx', 'utf8');
  const body = source.slice(source.indexOf('  const loadAvailableJobs ='), source.indexOf('  const loadDashboardData ='));
  const selected = [], counts = [], jobs = [];
  let fail = false;
  const q = { select(fields, options) { selected.push(options); return q; }, eq() { return q; }, gte() { return q; }, order() { return q; }, range() { return q; },
    then(resolve) { return Promise.resolve(fail ? { data: null, count: null, error: Error('offline') } : { data: Array.from({ length: 12 }, (_, i) => ({ id: i })), count: 120, error: null }).then(resolve); } };
  const env = { useCallback: fn => fn, beginRead: () => () => true, traceLog() {}, AVAILABLE_JOBS_PAGE_SIZE: 12,
    supabase: { from: () => q }, londonCalendarDate: () => '2026-11-27', oneRelation: row => row,
    setAvailableJobsCount: value => counts.push(value), setAvailableJobs: value => jobs.push(value),
    setHasMoreAvailableJobs() {}, setAvailableJobsPage() {}, setDataErrors() {} };
  const code = ts.transpileModule(body + '\nreturn loadAvailableJobs;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loader = new Function(...Object.keys(env), code)(...Object.values(env));
  await loader(); assert.equal(counts.at(-1), 120); assert.equal(jobs.at(-1).length, 12); assert.deepEqual(selected[0], { count: 'exact' });
  fail = true; await loader(); assert.equal(counts.at(-1), null);
});
