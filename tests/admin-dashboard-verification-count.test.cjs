const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

test('dashboard alert, KPI and action queue count all Pending guard states while keeping SIA separate', async () => {
  const statuses = [...Array(8).fill('pending'), 'manual_review', 'manual_review', 'pending_sia_check', 'approved', 'verified', 'rejected', 'suspended', null];
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = {
      select(_fields, options) { call.head = options?.head; return q; },
      eq(column, value) { call.filters.push([column, [value]]); return q; },
      in(column, values) { call.filters.push([column, values]); return q; },
      gte() { return q; }, gt() { return q; }, lt() { return q; }, not() { return q; }, or() { return q; },
      order() { return q; }, limit() { return q; }, range() { return q; },
      then(resolve, reject) {
        const filter = call.filters.find(([column]) => column === 'verification_status');
        const count = table === 'guards' ? statuses.filter(status => !filter || filter[1].includes(status)).length : table === 'sia_verifications' ? 4 : 0;
        return Promise.resolve({ data: [], count, error: null }).then(resolve, reject);
      },
    }; return q;
  }, channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; }, removeChannel() {} };
  const children = ['DashboardStats', 'DashboardAlerts', 'DashboardActivity', 'DashboardQuickActions', 'StripeConnectHealth', 'DashboardControlCentre'];
  const h = hooksHarness('app/admin/dashboard/page.tsx', {
    ...Object.fromEntries(children.map(name => ['./' + name, { __esModule: true, default: () => null }])),
    'next/link': { __esModule: true, default: () => null },
    '@/components/LiveIndicator': { __esModule: true, default: () => null },
    '@/components/admin/AdminPageShell': { __esModule: true, default: () => null },
    '@/lib/supabase': { supabase: db },
  }, { setInterval: () => 0, clearInterval() {} });
  h.render(); await h.effects();
  const tree = h.render();
  assert.equal(nodes(tree).find(node => typeof node.props?.pendingVerifications === 'number' && 'error' in node.props).props.error, null);
  const query = calls.find(call => call.table === 'guards' && call.head && call.filters.some(([column]) => column === 'verification_status'));
  assert.deepEqual(query.filters, [['verification_status', ['pending', 'manual_review', 'pending_sia_check']]]);
  const consumers = nodes(tree).filter(node => typeof node.props?.pendingVerifications === 'number');
  assert.equal(consumers.length, 2);
  for (const consumer of consumers) assert.equal(consumer.props.pendingVerifications, 11);
  const alerts = nodes(tree).find(node => Array.isArray(node.props?.alerts));
  assert(alerts.props.alerts.some(alert => alert.title === '11 Guards Awaiting Verification'));
  assert(nodes(tree).some(node => node.props?.pendingSiaVerifications === 4));
  assert.doesNotMatch(content(tree), /Database query failed/);
  h.unmount();
});
