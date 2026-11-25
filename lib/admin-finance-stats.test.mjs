import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { load } = require('../tests/helpers/enterprise-module.cjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const finance = load(path.join(ROOT, 'lib/admin-finance-stats.ts'));
const guards = load(path.join(ROOT, 'lib/admin-dashboard-stats.ts'));

const {
  FINANCE_BASE_QUERY_KEYS,
  FINANCE_COUNT_KEYS,
  FINANCE_LABELS,
  settleFinanceResults,
  buildFinanceSnapshot,
  createUnavailableFinanceSnapshot,
} = finance;
const { createLatestRequestTracker, createTimeoutScope, withTimeout } = guards;

const BASE_KEYS = FINANCE_BASE_QUERY_KEYS;
const pageSource = read('app/admin/platform-finances/PlatformFinancesClient.tsx');

const fulfilled = (value) => ({ status: 'fulfilled', value });
const rejected = (message) => ({ status: 'rejected', reason: new Error(message) });
const countResult = (count) => fulfilled({ count, data: null, error: null });
const rowsResult = (data) => fulfilled({ data, error: null });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function baseEntries(overrides = {}) {
  return BASE_KEYS.map((key) => ({
    key,
    settlement: overrides[key] ?? (FINANCE_COUNT_KEYS.includes(key) ? countResult(0) : rowsResult([])),
  }));
}

const ENRICHMENT_KEYS = ['paymentClientsByUser', 'transactionClients', 'paymentClients'];

function enrichmentEntries(overrides = {}) {
  return ENRICHMENT_KEYS.map((key) => ({ key, settlement: overrides[key] ?? rowsResult([]) }));
}

function settlementOf(overrides = {}) {
  const base = settleFinanceResults(baseEntries(overrides));
  const extra = settleFinanceResults(enrichmentEntries(overrides));
  return {
    values: { ...base.values, ...extra.values },
    baseValues: base.values,
    failures: [...base.failures, ...extra.failures],
  };
}

const EMPTY_ENRICHMENT = {
  paymentSubscriptions: { data: [], error: null },
  paymentClients: { data: [], error: null },
  paymentClientsByUser: { data: [], error: null },
  transactionClients: { data: [], error: null },
};

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} is not close to ${expected}`);
}

test('a rejected finance query makes the whole page unavailable, never zero', () => {
  const base = settleFinanceResults(baseEntries({ platformCosts: rejected('network down') }));
  assert.equal(base.failures.length, 1);
  assert.equal(base.failures[0].key, 'platformCosts');
  assert.match(base.failures[0].message, /network down/);

  const snapshot = buildFinanceSnapshot(base.values, EMPTY_ENRICHMENT);
  assert.equal(snapshot.available, false);
  assert.equal('data' in snapshot, false);
  assert.ok(snapshot.failures.some((failure) => failure.key === 'platformCosts'));
});

test('a fulfilled Supabase error result is treated as a failure', () => {
  const base = settleFinanceResults(
    baseEntries({ financeSnapshots: fulfilled({ data: null, error: { message: 'permission denied' } }) })
  );
  assert.deepEqual(base.failures.map((failure) => failure.key), ['financeSnapshots']);
  assert.match(base.failures[0].message, /permission denied/);
});

test('an initial total failure cannot produce an empty-but-healthy page', () => {
  const allRejected = BASE_KEYS.map((key) => ({ key, settlement: rejected('backend unreachable') }));
  const base = settleFinanceResults(allRejected);

  assert.equal(base.failures.length, BASE_KEYS.length);
  const snapshot = buildFinanceSnapshot(base.values, EMPTY_ENRICHMENT);
  assert.equal(snapshot.available, false);
  assert.ok(snapshot.failures.length > 0);
});

test('a succeeded count query without a numeric count is not read as zero', () => {
  const base = settleFinanceResults(
    baseEntries({ activeSubscriptions: fulfilled({ count: null, data: null, error: null }) })
  );
  assert.deepEqual(base.failures.map((failure) => failure.key), ['activeSubscriptions']);
  assert.match(base.failures[0].message, /Count was not returned/);
});

test('a succeeded row query without an array is not read as empty success', () => {
  const base = settleFinanceResults(baseEntries({ subscriptionPayments: fulfilled({ data: null, error: null }) }));
  assert.deepEqual(base.failures.map((failure) => failure.key), ['subscriptionPayments']);
});

test('a missing customer lookup is surfaced instead of showing Unknown names', () => {
  const base = settleFinanceResults(baseEntries());
  const snapshot = buildFinanceSnapshot(base.values, {});

  assert.equal(snapshot.available, false);
  assert.ok(snapshot.failures.some((failure) => failure.key === 'paymentClients'));
});

test('genuine zero results still produce a zero finance page', () => {
  const { values, failures } = settlementOf();
  assert.deepEqual(failures, []);

  const snapshot = buildFinanceSnapshot(values, EMPTY_ENRICHMENT);
  assert.equal(snapshot.available, true);
  assert.deepEqual(snapshot.data.payments, []);
  assert.deepEqual(snapshot.data.costs, []);
  assert.equal(snapshot.data.activeSubscriptionCount, 0);
  assert.equal(snapshot.data.guardsThisMonth, 0);
  assert.equal(snapshot.data.clientsThisMonth, 0);
});

test('payment rows keep exact amounts, refunds and fee-adjusted totals', () => {
  const { baseValues, values, failures } = settlementOf({
    subscriptionPayments: rowsResult([
      {
        id: 'p1',
        subscription_id: 's1',
        user_id: 'u1',
        amount: 100,
        status: 'succeeded',
        refunded: false,
        refund_amount: null,
        created_at: '2026-05-02T10:00:00.000Z',
        stripe_invoice_id: 'inv_1',
      },
    ]),
    transactions: rowsResult([
      {
        id: 't1',
        client_id: 'c3',
        amount: 50,
        status: 'partially_refunded',
        refund_amount: 20,
        created_at: '2026-05-03T10:00:00.000Z',
        transaction_type: 'job_payment',
      },
    ]),
    subscriptions: rowsResult([
      {
        id: 's1',
        client_id: 'c1',
        plan_name: 'Pro',
        status: 'active',
        plan_amount: 4900,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]),
  });
  assert.deepEqual(failures, []);

  const enrichment = {
    paymentSubscriptions: { data: [{ id: 's1', client_id: 'c1', plan_name: 'Pro' }], error: null },
    paymentClients: {
      data: [{ id: 'c1', company_name: 'Acme Ltd', email: 'a@acme.test', contact_name: 'Jo' }],
      error: null,
    },
    paymentClientsByUser: {
      data: [{ id: 'c2', user_id: 'u1', company_name: 'Beta Ltd', email: 'b@beta.test' }],
      error: null,
    },
    transactionClients: {
      data: [{ id: 'c3', company_name: 'Gamma Ltd', email: 'g@gamma.test' }],
      error: null,
    },
  };

  const snapshot = buildFinanceSnapshot(baseValues, { ...values, ...enrichment });
  assert.equal(snapshot.available, true);

  const [jobPayment, subscriptionPayment] = snapshot.data.payments;
  assert.equal(jobPayment.id, 't1');
  assert.equal(jobPayment.customer, 'Gamma Ltd');
  closeTo(jobPayment.stripe_fee, 0.95);
  closeTo(jobPayment.refund_amount, 20);
  closeTo(jobPayment.remaining_amount, 30);
  closeTo(jobPayment.net_amount, 29.05);

  assert.equal(subscriptionPayment.id, 'p1');
  assert.equal(subscriptionPayment.customer, 'Acme Ltd');
  assert.equal(subscriptionPayment.plan, 'Pro');
  assert.equal(subscriptionPayment.invoice_id, 'inv_1');
  closeTo(subscriptionPayment.stripe_fee, 1.7);
  closeTo(subscriptionPayment.remaining_amount, 100);
  closeTo(subscriptionPayment.net_amount, 98.3);
});

test('a subscription without an owner still resolves the customer by user id', () => {
  const { baseValues, values } = settlementOf({
    subscriptionPayments: rowsResult([
      { id: 'p2', user_id: 'u1', amount: 20, status: 'succeeded', created_at: '2026-05-04T10:00:00.000Z' },
    ]),
  });

  const snapshot = buildFinanceSnapshot(baseValues, {
    ...values,
    paymentClientsByUser: {
      data: [{ id: 'c9', user_id: 'u1', company_name: 'Delta Ltd', email: 'd@delta.test' }],
      error: null,
    },
  });

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.data.payments[0].customer, 'Delta Ltd');
  assert.equal(snapshot.data.payments[0].plan, 'Subscription');
});

test('finance counts are preserved exactly for the KPI panels', () => {
  const { values } = settlementOf({
    activeSubscriptions: countResult(7),
    guardsThisMonth: countResult(3),
    guardsLastMonth: countResult(1),
    clientsThisMonth: countResult(2),
    clientsLastMonth: countResult(4),
    trialSubscriptions: countResult(5),
    cancelledSubscriptions: countResult(6),
  });

  const snapshot = buildFinanceSnapshot(values, EMPTY_ENRICHMENT);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.data.activeSubscriptionCount, 7);
  assert.equal(snapshot.data.guardsThisMonth, 3);
  assert.equal(snapshot.data.guardsLastMonth, 1);
  assert.equal(snapshot.data.clientsThisMonth, 2);
  assert.equal(snapshot.data.clientsLastMonth, 4);
  assert.equal(snapshot.data.trialCount, 5);
  assert.equal(snapshot.data.cancelledCount, 6);
});

test('a timeout becomes a retryable unavailable state', () => {
  const snapshot = createUnavailableFinanceSnapshot('Finance data request timed out');
  assert.equal(snapshot.available, false);
  assert.match(snapshot.failures[0].message, /timed out/);
});

test('every finance query key has a readable failure label', () => {
  for (const key of [...BASE_KEYS, ...ENRICHMENT_KEYS]) {
    assert.equal(typeof FINANCE_LABELS[key], 'string');
    assert.ok(FINANCE_LABELS[key].length > 0);
  }
});

test('the page checks every finance query through one settlement step', () => {
  assert.match(pageSource, /Promise\.allSettled/);
  assert.ok((pageSource.match(/settleFinanceResults\(/g) || []).length >= 3);
  assert.match(pageSource, /createTimeoutScope/);
  assert.match(pageSource, /createLatestRequestTracker/);
  assert.match(pageSource, /FINANCE_TIMEOUT_MS/);
  assert.match(pageSource, /FinanceUnavailable/);
  assert.match(pageSource, /schema\('app'\)/);
  assert.equal(/const \{ data: [a-zA-Z]+ \} = await/.test(pageSource), false);
});

test('failure paths return before any finance value is written', () => {
  const writeIndex = pageSource.indexOf('setData(snapshot.data)');
  const unavailableBranch = pageSource.indexOf('if (!snapshot.available) {');

  assert.ok(writeIndex > -1);
  assert.ok(unavailableBranch > -1);
  assert.ok(unavailableBranch < writeIndex);
  assert.ok(pageSource.slice(unavailableBranch, writeIndex).includes('return;'));
  assert.equal(pageSource.includes('setData(EMPTY_FINANCE_DATA)'), false);
  assert.equal(pageSource.includes('?? 0'), false);
});

test('a stalled request times out and a retry can still succeed', async () => {
  const stalled = new Promise((resolve) => {
    setTimeout(() => resolve(baseEntries()), 60);
  });

  await assert.rejects(() => withTimeout(stalled, 5, 'Finance data request timed out'), /timed out/);
  const retried = await withTimeout(Promise.resolve('fresh'), 50, 'Finance data request timed out');
  assert.equal(retried, 'fresh');
});

test('clearing the timeout scope stops a late rejection after unmount', async () => {
  const scope = createTimeoutScope();
  let outcome = 'pending';

  scope.run(delay(40).then(() => 'late'), 10, 'timed out').then(
    () => {
      outcome = 'resolved';
    },
    () => {
      outcome = 'rejected';
    }
  );

  scope.clear();
  await delay(60);
  assert.equal(outcome, 'resolved');
});

test('only the newest refresh may apply its result', async () => {
  const tracker = createLatestRequestTracker();
  let applied = null;

  const run = async (waitMs, value) => {
    const id = tracker.begin();
    await delay(waitMs);
    if (!tracker.isCurrent(id)) return;
    applied = value;
  };

  await Promise.all([run(30, 'older'), run(5, 'newer')]);
  assert.equal(applied, 'newer');
});