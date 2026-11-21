const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { guardJobAcceptsApplications } = load('lib/guard-job-availability.ts');
const { guardApplicationGroup } = load('lib/guard-application-status.ts');
const { guardNotificationCategory } = load('lib/guard-notification-category.ts');
const { guardHistoryTotals, isPaidGuardPayoutStatus, sumPaidGuardPayouts } = load('lib/payments/guardPaymentDisplay.ts');

test('guard application dates use the UK day, including summer midnight, malformed dates and stale open cards', () => {
  const now = new Date('2026-06-20T23:30:00Z');
  assert.equal(guardJobAcceptsApplications({ status: 'open', start_date: '2026-06-20' }, now), false);
  assert.equal(guardJobAcceptsApplications({ status: 'open', start_date: '2026-06-21' }, now), true);
  for (const start_date of [null, '', '2026-02-30', 'bad-date']) assert.equal(guardJobAcceptsApplications({ status: 'open', start_date }, now), false);
  for (const status of ['draft', 'closed', 'cancelled', 'paid_out']) assert.equal(guardJobAcceptsApplications({ status, start_date: '2027-01-01' }, now), false);
  assert.equal(guardJobAcceptsApplications({ status: 'open', start_date: '2027-01-01', is_deleted: true }, now), false);
});

test('selected applications remain distinct from accepted offers; aliases are consistently grouped', () => {
  const rows = Array.from({ length: 7 }, () => ({ status: 'selected' }));
  assert.equal(rows.filter(row => guardApplicationGroup(row.status) === 'selected').length, 7);
  assert.equal(rows.filter(row => guardApplicationGroup(row.status) === 'accepted').length, 0);
  assert.equal(guardApplicationGroup('confirmed'), 'accepted');
  assert.equal(guardApplicationGroup('rejected'), 'declined');
  assert.equal(guardApplicationGroup('shortlisted'), 'reviewed');
  assert.equal(guardApplicationGroup('withdrawn'), 'withdrawn');
});

test('earnings reproduce the retained four payouts and exclude cancelled job face values', () => {
  const payouts = [10, 80, 80, 80].map(amount => ({ status: 'paid_out', amount, net_amount: amount }));
  const jobs = Array.from({ length: 5 }, () => ({ job_status: 'cancelled', assignment_status: 'cancelled', payment_amount: 80 }));
  assert.deepEqual(guardHistoryTotals(jobs, payouts), { totalEarned: 250, releasedPayout: 250, pendingPayout: 0 });
  for (const status of ['paid', 'completed', 'paid_out', 'PAID-OUT']) assert.equal(isPaidGuardPayoutStatus(status), true);
  for (const status of ['pending', 'funded', 'processing', 'failed', 'refunded', 'reversed', null]) assert.equal(isPaidGuardPayoutStatus(status), false);
});

test('payout amounts preserve zero net, numeric strings and fees without estimating earnings', () => {
  assert.equal(sumPaidGuardPayouts([{ status: 'paid_out', amount: 100, net_amount: 0 }, { status: 'paid', amount: '80', net_amount: '70' }, { status: 'reversed', amount: 80 }]), 70);
  const completed = { job_status: 'completed', assignment_status: 'completed', payment_amount: 100 };
  assert.equal(guardHistoryTotals([{ ...completed, payout: { status: 'pending', amount: 100, net_amount: 0 } }], []).pendingPayout, 0);
  assert.equal(guardHistoryTotals([{ ...completed, dispute_status: 'open' }, { ...completed, payout: { status: 'refunded', amount: 100 } }], []).pendingPayout, 0);
  assert.equal(guardHistoryTotals([{ ...completed, payout: { status: 'pending', amount: '100', net_amount: '90' } }], []).pendingPayout, 90);
});

test('semantic notification categories win over text and legacy payout titles remain discoverable', () => {
  for (const title of ['Payout Sent', 'Client Approved', 'Payment Released']) assert.equal(guardNotificationCategory({ type: 'success', title }), 'payment');
  assert.equal(guardNotificationCategory({ type: 'info', title: 'Application Submitted' }), 'application_update');
  assert.equal(guardNotificationCategory({ type: 'message', title: 'Payment Released' }), 'message');
  assert.equal(guardNotificationCategory({ category: 'payment', type: 'info', title: 'Update' }), 'payment');
  assert.equal(guardNotificationCategory({ type: 'welcome', title: 'Welcome aboard' }), 'welcome');
  assert.equal(guardNotificationCategory({ type: 'info', title: 'A client asks about a payment' }), 'info');
});
