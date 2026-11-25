import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {load} = require('../tests/helpers/enterprise-module.cjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const statsModule = load(path.join(ROOT, 'lib/admin-dashboard-stats.ts'), {});
const {
  STATS_RESULT_KEYS,
  STATS_RESULT_LABELS,
  STATS_COUNT_KEYS,
  STATS_ROW_KEYS,
  DASHBOARD_COLLECTED_STATUSES,
  buildDashboardSnapshot,
  buildAlerts,
  createUnavailableSnapshot,
  createLatestRequestTracker,
  createTimeoutScope,
  withTimeout,
  remainingRevenue,
} = statsModule;

const pageSource = read('app/admin/dashboard/page.tsx');
const adminDataSource = read('lib/adminData.ts');
const financeSource = read('lib/financeAmounts.ts');

const fulfilled = (value) => ({status: 'fulfilled', value});
const rejected = (message) => ({status: 'rejected', reason: new Error(message)});
const countResult = (count) => fulfilled({count, data: null, error: null});
const rowsResult = (data) => fulfilled({data, error: null});

function settlements(overrides = {}) {
  return STATS_RESULT_KEYS.map((key) => {
    if (key in overrides) return overrides[key];
    if (STATS_ROW_KEYS.includes(key)) return rowsResult([]);
    return countResult(2);
  });
}

function zeroSettlements(overrides = {}) {
  return STATS_RESULT_KEYS.map((key) => {
    if (key in overrides) return overrides[key];
    if (STATS_ROW_KEYS.includes(key)) return rowsResult([]);
    return countResult(0);
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a rejected query makes the whole stats snapshot unavailable, never zero', () => {
  const snapshot = buildDashboardSnapshot(settlements({totalJobs: rejected('network down')}));

  assert.equal(snapshot.available, false);
  assert.equal('stats' in snapshot, false);
  assert.equal('alerts' in snapshot, false);
  assert.equal(snapshot.failures.length, 1);
  assert.equal(snapshot.failures[0].key, 'totalJobs');
  assert.match(snapshot.failures[0].message, /network down/);
});

test('fulfilled Supabase error results are treated as failures', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    pendingVerifications: fulfilled({count: null, data: null, error: {message: 'permission denied'}}),
  }));

  assert.equal(snapshot.available, false);
  assert.deepEqual(snapshot.failures.map((f) => f.key), ['pendingVerifications']);
  assert.match(snapshot.failures[0].message, /permission denied/);
});

test('an initial total failure cannot produce a zero or all-healthy dashboard', () => {
  const allRejected = STATS_RESULT_KEYS.map(() => rejected('backend unreachable'));
  const snapshot = buildDashboardSnapshot(allRejected);

  assert.equal(snapshot.available, false);
  assert.equal(snapshot.failures.length, STATS_RESULT_KEYS.length);
  assert.equal(buildDashboardSnapshot(settlements()).available, true);
  assert.equal(snapshot.available, false);
});

test('a succeeded query without a numeric count is not reported as zero', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    activeJobs: fulfilled({count: null, data: null, error: null}),
  }));

  assert.equal(snapshot.available, false);
  assert.deepEqual(snapshot.failures.map((f) => f.key), ['activeJobs']);
  assert.match(snapshot.failures[0].message, /Count was not returned/);
});

test('a succeeded row query without an array is not reported as empty success', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    monthlySubscriptionRevenue: fulfilled({data: null, error: null}),
  }));

  assert.equal(snapshot.available, false);
  assert.deepEqual(snapshot.failures.map((f) => f.key), ['monthlySubscriptionRevenue']);
});

test('a mismatched query set is rejected instead of silently shifting values', () => {
  const snapshot = buildDashboardSnapshot(settlements().slice(0, 5));

  assert.equal(snapshot.available, false);
  assert.equal(snapshot.failures[0].key, 'querySet');
});

test('genuine zero results still produce a zero dashboard', () => {
  const zero = STATS_RESULT_KEYS.reduce((acc, key) => {
    acc[key] = STATS_ROW_KEYS.includes(key) ? rowsResult([]) : countResult(0);
    return acc;
  }, {});
  const snapshot = buildDashboardSnapshot(settlements(zero));

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.stats.totalJobs, 0);
  assert.equal(snapshot.stats.monthlyRevenue, 0);
  assert.equal(snapshot.stats.avgMatchTimeMinutes, null);
  assert.equal(snapshot.alerts.length, 1);
  assert.equal(snapshot.alerts[0].type, 'info');
});

test('the page returns early on failure so previous values are not overwritten with zeros', () => {
  const unavailableBranch = pageSource.indexOf('if (!snapshot.available) {');
  const statsWrite = pageSource.indexOf('setStats(snapshot.stats)');
  const zeroFallback = pageSource.indexOf('?? 0');

  assert.ok(unavailableBranch > -1, 'dashboard must branch on unavailable snapshots');
  assert.ok(statsWrite > -1, 'dashboard must apply successful stats');
  assert.ok(unavailableBranch < statsWrite, 'failure must be handled before stats are written');
  assert.ok(
    pageSource.slice(unavailableBranch, statsWrite).includes('return;'),
    'failure branch must return without writing stats'
  );
  assert.equal(zeroFallback, -1, 'dashboard must not fall back to zero counts');
});

test('timeout rejects a stalled request and retry can still produce fresh data', async () => {
  const stalled = new Promise((resolve) => {
    setTimeout(() => resolve(settlements()), 60);
  });

  await assert.rejects(
    () => withTimeout(stalled, 5, 'Dashboard metrics request timed out'),
    /timed out/
  );

  const retried = await withTimeout(Promise.resolve('fresh'), 50, 'Dashboard metrics request timed out');
  assert.equal(retried, 'fresh');
});

test('a timeout settles only once and a late result cannot overwrite it', async () => {
  let outcome = 'pending';
  const stalled = delay(40).then(() => 'late');

  await withTimeout(stalled, 5, 'timed out').then(
    () => { outcome = 'resolved'; },
    () => { outcome = 'rejected'; }
  );

  await delay(60);
  assert.equal(outcome, 'rejected');
});

test('a fast success clears its timer and does not fire a late timeout', async () => {
  const value = await withTimeout(Promise.resolve('quick'), 30, 'timed out');
  assert.equal(value, 'quick');
  await delay(45);
  assert.equal(value, 'quick');
});

test('only the newest request may apply its result', () => {
  const tracker = createLatestRequestTracker();
  const first = tracker.begin();
  const second = tracker.begin();

  assert.equal(tracker.isCurrent(first), false);
  assert.equal(tracker.isCurrent(second), true);

  tracker.invalidate();
  assert.equal(tracker.isCurrent(second), false);
});

test('a slower older refresh cannot overwrite a newer result', async () => {
  const tracker = createLatestRequestTracker();
  let applied = null;

  const run = async (waitMs, value) => {
    const id = tracker.begin();
    await delay(waitMs);
    if (!tracker.isCurrent(id)) return;
    applied = value;
  };

  const older = run(30, 'older');
  const newer = run(5, 'newer');
  await Promise.all([older, newer]);

  assert.equal(applied, 'newer');
});

test('clearing the timeout scope stops a stalled request from rejecting after unmount', async () => {
  const scope = createTimeoutScope();
  let outcome = 'pending';

  scope.run(delay(40).then(() => 'late'), 10, 'timed out').then(
    () => { outcome = 'resolved'; },
    () => { outcome = 'rejected'; }
  );

  scope.clear();
  await delay(60);
  assert.equal(outcome, 'resolved');
});

test('the timeout scope still resolves fast requests and clears its timer', async () => {
  const scope = createTimeoutScope();
  assert.equal(await scope.run(Promise.resolve('ok'), 20, 'timed out'), 'ok');
  scope.clear();
  await delay(30);
});

test('timeout failures produce a clearly unavailable snapshot with a retryable message', () => {
  const snapshot = createUnavailableSnapshot('Dashboard metrics request timed out');
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.failures.length, 1);
  assert.match(snapshot.failures[0].message, /timed out/);
});

test('revenue excludes refunds, uncollected and invalid amounts', () => {
  const rows = [
    {amount: 100, status: 'succeeded', refunded: false},
    {amount: 50, status: 'refunded'},
    {amount: 80, status: 'partially_refunded', refund_amount: 30},
    {amount: 20, status: 'completed', refunded: true},
    {amount: 999, status: 'pending'},
    {amount: 'invalid', status: 'paid'},
    {amount: 10.555, status: 'paid'},
    null,
  ];

  assert.equal(remainingRevenue(rows), 160.56);
  assert.equal(remainingRevenue([]), 0);
  assert.equal(remainingRevenue(null), 0);
});

test('monthly revenue adds subscription and transaction sources only when both load', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    monthlySubscriptionRevenue: rowsResult([{amount: 100, status: 'succeeded'}]),
    monthlyTransactionRevenue: rowsResult([{amount: 40, status: 'succeeded', refund_amount: 10}]),
    prevMonthlySubscriptionRevenue: rowsResult([{amount: 50, status: 'succeeded'}]),
    prevMonthlyTransactionRevenue: rowsResult([]),
  }));

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.stats.monthlyRevenue, 130);
  assert.equal(snapshot.trends.monthlyRevenueTrend, 160);
});

test('a failed secondary match-time jobs query keeps match time unavailable', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    jobDates: rejected('jobs unavailable'),
    monthlyMatchTimeAssignments: rowsResult([{assigned_at: '2026-05-02T10:00:00.000Z', job_id: 'job-1'}]),
  }));

  assert.equal(snapshot.available, false);
  assert.deepEqual(snapshot.failures.map((f) => f.key), ['jobDates']);
});

test('match time ignores assignments without a known job date and stays null', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    monthlyMatchTimeAssignments: rowsResult([{assigned_at: '2026-05-02T10:00:00.000Z', job_id: 'missing'}]),
  }));

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.stats.avgMatchTimeMinutes, null);
  assert.equal(snapshot.trends.avgMatchTimeTrend, null);
});

test('match time averages valid assignments when job dates are present', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    jobDates: rowsResult([
      {id: 'job-1', created_at: '2026-05-01T10:00:00.000Z'},
      {id: 'job-2', created_at: '2026-05-01T10:00:00.000Z'},
    ]),
    monthlyMatchTimeAssignments: rowsResult([
      {assigned_at: '2026-05-01T10:30:00.000Z', job_id: 'job-1'},
      {assigned_at: '2026-05-01T12:00:00.000Z', job_id: 'job-2'},
    ]),
  }));

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.stats.avgMatchTimeMinutes, 75);
});

test('monthly trends distinguish a real zero baseline from missing data', () => {
  const snapshot = buildDashboardSnapshot(settlements({
    newJobsThisMonth: countResult(10),
    prevNewJobs: countResult(0),
  }));

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.trends.newJobsThisMonthTrend, 100);

  const flat = buildDashboardSnapshot(settlements({
    newJobsThisMonth: countResult(0),
    prevNewJobs: countResult(0),
  }));
  assert.equal(flat.available, true);
  assert.equal(flat.trends.newJobsThisMonthTrend, null);
});

test('alerts are derived only from real counts and never emitted without data', () => {
  const snapshot = buildDashboardSnapshot(zeroSettlements({
    pendingVerifications: countResult(3),
    failedSubscriptionPayments: countResult(1),
  }));

  assert.equal(snapshot.available, true);
  assert.deepEqual(snapshot.alerts.map((a) => a.type), ['warning', 'critical']);
  assert.match(snapshot.alerts[0].title, /3 Guards Awaiting Verification/);

  const zeroStats = buildDashboardSnapshot(zeroSettlements());
  assert.equal(zeroStats.available, true);
  assert.equal(buildAlerts(zeroStats.stats)[0].type, 'info');

  const failing = buildDashboardSnapshot(zeroSettlements({openComplaints: rejected('boom')}));
  assert.equal(failing.available, false);
  assert.equal('alerts' in failing, false);
});

test('every dashboard query key has a readable failure label', () => {
  for (const key of STATS_RESULT_KEYS) {
    assert.equal(typeof STATS_RESULT_LABELS[key], 'string');
    assert.ok(STATS_RESULT_LABELS[key].length > 0);
  }
  assert.ok(STATS_COUNT_KEYS.length > 0);
  assert.ok(STATS_ROW_KEYS.length > 0);
});

test('dashboard collected statuses stay aligned with financeAmounts', () => {
  const match = financeSource.match(/collectedStatuses\s*=\s*\[([^\]]+)\]/);
  assert.ok(match, 'financeAmounts must define collectedStatuses');
  const statuses = match[1]
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  assert.deepEqual([...DASHBOARD_COLLECTED_STATUSES], statuses);
  assert.equal(remainingRevenue([{amount: 1, status: 'succeeded'}]), 1);
  assert.equal(remainingRevenue([{amount: 1, status: 'refunded'}]), 0);
});

test('the dashboard no longer uses the zero-filling settleResults helper', () => {
  assert.equal(adminDataSource.includes('settleResults'), false);
  assert.equal(pageSource.includes('settleResults'), false);
  assert.match(pageSource, /@\/lib\/admin-dashboard-stats'/);
  assert.match(pageSource, /Promise\.allSettled/);
  assert.match(pageSource, /createTimeoutScope/);
  assert.match(pageSource, /STATS_TIMEOUT_MS/);
});