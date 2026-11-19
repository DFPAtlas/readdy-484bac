const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : require(name));
  return module.exports;
}
const clock = require('../lib/attendance-display.cjs');
const tracker = load('lib/client-job-tracker.ts', { './attendance-display.cjs': clock });
const listing = load('lib/client-job-list.ts', { './client-job-tracker': tracker });
const attendance = load('lib/client-dashboard-attendance.ts', { './attendance-display.cjs': clock, './client-job-tracker': tracker });
const now = new Date('2026-11-19T18:30:00Z');
const empty = { guardsNotCheckedIn: 0, lateGuards: 0, noShows: 0, jobsNeedingReplacement: 0 };
const job = (id, status = 'confirmed', extra = {}) => ({ id, client_id: 'client', is_deleted: false, status, job_title: id, created_at: '2026-11-01', start_date: '2026-11-19', start_time: '18:00', end_date: null, end_time: '22:00', ...extra });
const assignment = (id, job_id, extra = {}) => ({ id, job_id, guard_id: 'guard-' + id, status: 'confirmed', attendance_status: 'confirmed', ...extra });

function database(rows, override = () => undefined) {
  const calls = [];
  const db = { calls, schema(name) { assert.equal(name, 'app'); return db; }, from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const q = { select(fields, options = {}) { call.fields = fields; call.options = options; return q; },
      eq(key, value) { call.filters.push(['eq', key, value]); return q; }, in(key, value) { call.filters.push(['in', key, value]); return q; },
      gte() { return q; }, lte() { return q; }, order(key, options) { call.orders.push([key, options.ascending]); return q; },
      range(first, last) { call.range = [first, last]; return q; }, then(resolve, reject) {
        return Promise.resolve().then(() => {
          const custom = override(call); if (custom !== undefined) return custom;
          let data = (rows[table] || []).filter(row => call.filters.every(([method, key, value]) => method === 'in' ? value.includes(row[key]) : row[key] === value));
          data.sort((a, b) => { for (const [key, asc] of call.orders) { const cmp = String(a[key] || '').localeCompare(String(b[key] || '')); if (cmp) return asc ? cmp : -cmp; } return 0; });
          const count = data.length; if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
          return { data, count, error: null };
        }).then(resolve, reject);
      } };
    return q;
  } };
  return db;
}
function query(db) {
  return load('lib/client-queries.ts', { './supabase': { supabase: db }, './client-job-list': listing,
    './client-dashboard-attendance': attendance, './client-safety': { isSafetyStartingSoon: () => false },
    './client-safety-data': { loadClientSafetySummary: async () => ({ missingSafetyInfo: 0, highRiskJobs: 0, complianceWarnings: 0, missingEmergencyContacts: 0 }) },
    './financeAmounts': load('lib/financeAmounts.ts'),
  }).getClientDashboardStats('client', 'user');
}

test('historical, deleted, foreign and non-operational jobs do not generate dashboard attendance alerts', async () => {
  const states = ['draft', 'pending', 'open', 'awaiting_payment', 'awaiting_client_approval', 'completed', 'payout_approved', 'paid_out', 'review_pending', 'cancelled', 'closed', 'unknown'];
  const jobs = states.map(status => job(status, status));
  const assignments = jobs.map(row => assignment(row.id, row.id, { attendance_status: 'no_show', replacement_requested: true }));
  assert.deepEqual(attendance.dashboardAttendance(jobs, assignments, now), empty);
  assert.deepEqual(attendance.dashboardAttendance([job('deleted', 'in_progress', { is_deleted: true })], [assignment('a', 'deleted')], now), empty);
  const result = await query(database({ jobs: [...jobs, job('foreign', 'confirmed', { client_id: 'other' }), job('deleted', 'confirmed', { is_deleted: true })], job_assignments: [...assignments, assignment('foreign', 'foreign'), assignment('deleted', 'deleted')] }));
  assert.equal(result.error, null);
  for (const [key, value] of Object.entries(empty)) assert.equal(result.actionData.actionData[key], value);
});

test('only unfinished current assignments contribute; replacements count jobs rather than guards', () => {
  const jobs = [job('live', 'in_progress')];
  const rows = [assignment('due', 'live', { replacement_requested: true }), assignment('late', 'live', { attendance_status: 'late', check_in_time: '2026-11-19T18:10:00Z', replacement_requested: true }), assignment('no-show', 'live', { attendance_status: 'no_show' }),
    assignment('cancelled', 'live', { status: 'cancelled' }), assignment('completed', 'live', { status: 'completed' }), assignment('out', 'live', { check_out_time: '2026-11-19T18:20:00Z' }), assignment('finished', 'live', { completed_at: '2026-11-19T18:20:00Z' }), assignment('checked-out', 'live', { attendance_status: 'checked_out' }), assignment('already-in', 'live', { check_in_time: '2026-11-19T18:00:00Z' })];
  assert.deepEqual(attendance.dashboardAttendance(jobs, rows, now), { guardsNotCheckedIn: 1, lateGuards: 1, noShows: 1, jobsNeedingReplacement: 1 });
  for (const status of ['funded', 'confirmed', 'in_progress']) assert.equal(attendance.dashboardAttendance([job('live', status)], [assignment('a', 'live')], now).guardsNotCheckedIn, 1);
});

test('UK summer time, overnight shifts, future/ended shifts and malformed schedules do not invent overdue alerts', () => {
  const cases = [
    [job('j', 'confirmed', { start_date: '2026-07-01', start_time: '18:00', end_time: '22:00' }), '2026-07-01T17:00:00Z', 1],
    [job('j', 'confirmed', { start_time: '22:00', end_time: '06:00' }), '2026-11-20T01:00:00Z', 1],
    [job('j'), '2026-11-19T17:59:59Z', 0], [job('j'), '2026-11-19T22:00:00Z', 0],
    [job('j', 'confirmed', { start_date: '2026-02-30' }), now, 0], [job('j', 'confirmed', { start_time: null }), now, 0],
  ];
  for (const [j, time, expected] of cases) assert.equal(attendance.dashboardAttendance([j], [assignment('a', 'j')], new Date(time)).guardsNotCheckedIn, expected);
  const future = attendance.dashboardAttendance([job('j')], [assignment('a', 'j', { attendance_status: 'late', replacement_requested: true })], new Date('2026-11-19T17:00:00Z'));
  assert.equal(future.lateGuards, 0); assert.equal(future.jobsNeedingReplacement, 1);
});

test('actual dashboard query reads complete owned pages and derives historical assignment totals without cancelled guards', async () => {
  const jobs = Array.from({ length: 205 }, (_, n) => job(String(n).padStart(3, '0'), 'paid_out', { assigned_count: 0 }));
  const rows = jobs.map(j => assignment(j.id, j.id, { status: 'completed' }));
  rows.push(assignment('duplicate', jobs[0].id, { guard_id: rows[0].guard_id }), assignment('cancelled', jobs[0].id, { status: 'cancelled' }));
  const db = database({ jobs, job_assignments: rows }); const result = await query(db);
  assert.equal(result.stats.total_jobs, 205); assert.equal(result.stats.completed_jobs, 205);
  assert.equal(result.actionData.recentJobs.length, 205); assert.equal(result.actionData.recentJobs[0].assigned_count, 1);
  for (const table of ['jobs', 'job_assignments']) assert.ok(db.calls.some(call => call.table === table && call.range?.[0] === 200));
  for (const call of db.calls.filter(c => c.table === 'jobs' && c.range)) {
    assert.ok(call.filters.some(f => f[1] === 'client_id' && f[2] === 'client')); assert.ok(call.filters.some(f => f[1] === 'is_deleted' && f[2] === false));
    assert.deepEqual(call.orders.map(o => o[0]), ['created_at', 'id']);
  }
  const selected = db.calls.find(c => c.table === 'job_assignments' && c.range).fields;
  for (const field of ['check_out_time', 'completed_at', 'guard_confirmed_at']) assert.ok(selected.includes(field));
});

test('failed or malformed assignment reads reject instead of successful zero alerts; jobs errors remain explicit', async () => {
  for (const response of [{ data: null, error: { message: 'failure' } }, { data: null, error: null }, Error('offline')]) {
    const db = database({ jobs: [job('j')] }, call => { if (call.table !== 'job_assignments') return; if (response instanceof Error) throw response; return response; });
    await assert.rejects(query(db));
  }
  const failedJobs = await query(database({}, call => call.table === 'jobs' ? { data: null, error: { message: 'read failed' } } : undefined));
  assert.match(failedJobs.error, /could not be loaded/); assert.deepEqual(failedJobs.actionData, {});
});

test('dashboard error hides summary cards rather than showing stale alerts or reassuring zeroes', () => {
  let state = 0;
  const stateNames = [...fs.readFileSync('app/client/dashboard/page.tsx', 'utf8').matchAll(/const \[([^\]]*)\] = useState/g)].map(match => match[1].split(',')[0].trim());
  const page = load('app/client/dashboard/page.tsx', {
    react: { ...React, useEffect() {}, useState(initial) { const name = stateNames[state++]; return [name === 'client' ? { id: 'client', contact_name: 'Synthetic' } : name === 'loading' ? false : name === 'dashboardError' ? 'Failed to load dashboard.' : initial, () => {}]; } },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) },
    '@/hooks/useRouteGuard': { useRouteGuard: () => ({ checking: false, blocked: false }) },
    '@/lib/supabase': { supabase: {} }, '@/lib/client-queries': {}, '@/lib/entitlements': {},
    '@/hooks/useUsageLimits': { useUsageLimits: () => ({ loading: false, limits: [] }) },
    '@/lib/dashboard-helpers': {}, '@/lib/client-journey': { planLabel: () => 'Test' },
    ...Object.fromEntries([...fs.readFileSync('app/client/dashboard/page.tsx', 'utf8').matchAll(/import (?:[\s\S]*?) from ["']([^"']+)["'];/g)].map(match => match[1]).filter(name => name.startsWith('./') || name.startsWith('@/components/') || name.startsWith('@/app/client/')).map(name => [name, new Proxy({ __esModule: true, default: () => null }, { get(target, key) { return key in target ? target[key] : () => null; } })])),
    './DashboardStates': { DashboardErrorBanner: ({ message }) => React.createElement('div', { role: 'alert' }, message), PaymentRequiredBanner: () => null },
    './ActionRequired': { __esModule: true, default: () => React.createElement('div', null, 'ATTENDANCE SUMMARY') },
    './RecentJobs': { __esModule: true, default: () => React.createElement('div', null, 'ASSIGNMENT TOTALS') },
    './NextActions': { __esModule: true, default: () => React.createElement('div', null, 'JOB NEXT ACTIONS') },
  }).default;
  const html = renderToStaticMarkup(React.createElement(page));
  assert.match(html, /Failed to load dashboard/); assert.doesNotMatch(html, /ATTENDANCE SUMMARY|ASSIGNMENT TOTALS|JOB NEXT ACTIONS|No current shift alerts/);
});

test('actual dashboard refresh surfaces returned and thrown stats failures and a successful Retry replaces the error', async () => {
  const source = fs.readFileSync('app/client/dashboard/page.tsx', 'utf8');
  const start = source.indexOf('  loadDashboardRef.current = useCallback');
  const body = source.slice(start, source.indexOf('\n  const debouncedReload', start));
  const setters = [...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => match[1]))];
  for (const failure of ['returned', 'thrown']) {
    let fail = true; const writes = [];
    const dashboard = { stats: { total_jobs: 9 }, actionData: { actionData: { guardsNotCheckedIn: 0 } }, error: null };
    const env = { useCallback: fn => fn, loadDashboardRef: { current: null }, mountedRef: { current: true }, loadingRef: { current: false }, traceLog() {}, router: { push() { assert.fail('stats errors must not redirect'); } },
      getCurrentUser: async () => ({ id: 'user' }), getClientDashboardStats: async () => { if (!fail) return dashboard; if (failure === 'thrown') throw Error('offline'); return { ...dashboard, error: 'read failed' }; },
      getRecommendedGuards: async () => ({ guards: [] }), ensureEntitlement: async () => ({}), getAllClientFeaturesFromEntitlement: async () => ({}), CLIENT_FEATURE_KEYS: [], hasFeature: async () => false,
      computeOnboarding: () => ({ items: [], progress: 0, completedCount: 0, totalCount: 0 }),
      supabase: { rpc: async () => ({ data: null }), from(table) { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'clients' ? { id: 'client' } : null }) }; return q; } },
      ...Object.fromEntries(setters.map(name => [name, value => writes.push({ name, value })])),
    };
    const code = ts.transpileModule(body + '\nreturn loadDashboardRef.current;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const refresh = new Function(...Object.keys(env), code)(...Object.values(env));
    await refresh(); assert.match(writes.filter(w => w.name === 'setDashboardError').at(-1).value, /Failed to load dashboard/);
    assert.equal(writes.some(w => w.name === 'setActionData'), false); assert.equal(env.loadingRef.current, false);
    fail = false; await refresh();
    assert.equal(writes.filter(w => w.name === 'setDashboardError').at(-1).value, null);
    assert.deepEqual(writes.find(w => w.name === 'setActionData').value, dashboard.actionData.actionData);
  }
});
