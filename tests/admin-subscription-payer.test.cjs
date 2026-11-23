const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

function fixture({ guards = [], clients = [], guardError = false } = {}) {
  const rows = {
    transactions: [{ id: 'job-payment', client_id: 'client-id', amount: 88, status: 'completed', created_at: '2026-11-01T12:00:00Z' }],
    subscription_payments: [{ id: 'renewal', subscription_id: 'basic', user_id: 'guard-user', amount: 10, status: 'succeeded', billing_reason: 'subscription_cycle', created_at: '2026-11-22T19:35:31Z' }],
    subscriptions: [], guards, clients,
  };
  const calls = [];
  const db = { from(table) {
    const call = { table, fields: null, filters: [] }; calls.push(call);
    const q = {
      select(fields) { call.fields = fields; return q; }, order() { return q; }, limit() { return q; }, not() { return q; },
      in(key, values) { call.filters.push([key, values]); return q; },
      then(resolve, reject) {
        const data = (rows[table] || []).filter(row => call.filters.every(([key, values]) => values.includes(row[key])));
        return Promise.resolve(table === 'guards' && guardError
          ? { data: null, error: { message: 'Lookup unavailable' } }
          : { data, error: null }).then(resolve, reject);
      },
    };
    return q;
  }};
  const h = hooksHarness('app/admin/payments/page.tsx', {
    '@/lib/supabase': { supabase: db },
    '../payments-jobs/RefundRequestQueue': { __esModule: true, default: () => null },
  }, { setTimeout: () => 0 });
  return { h, calls, async start() { h.render(); await h.effects(); },
    subscriptionRow() { return nodes(h.render()).find(n => n.type === 'tr' && content(n).includes('subscription_cycle')); } };
}

test('guard subscription payer is shown in the table, search and payment details', async () => {
  const f = fixture({ guards: [
    { id: 'guard-id', user_id: 'guard-user', full_name: 'Synthetic Basic Guard' },
    { id: 'other-id', user_id: 'other-user', full_name: 'Unrelated Guard' },
  ] });
  await f.start();
  const row = f.subscriptionRow();
  assert.match(content(row), /Synthetic Basic Guard/);
  assert.doesNotMatch(content(row), /Unknown|Unrelated Guard/);
  assert.match(content(row), /£10\.00.*SUCCEEDED/);
  const lookup = f.calls.find(c => c.table === 'guards' && c.filters.some(([key]) => key === 'user_id'));
  assert.equal(lookup.fields, 'user_id, full_name');
  assert.deepEqual(lookup.filters, [['user_id', ['guard-user']]]);
  nodes(row).find(n => n.type === 'button' && content(n) === 'View').props.onClick();
  assert.match(content(f.h.render()), /PayerSynthetic Basic Guard/);
  nodes(f.h.render()).find(n => n.type === 'button' && content(n) === 'Close').props.onClick();
  const search = nodes(f.h.render()).find(n => n.type === 'input');
  search.props.onChange({ target: { value: 'Synthetic Basic Guard' } });
  assert(f.subscriptionRow());
  assert.doesNotMatch(content(f.h.render()), /Unrelated Guard/);
});

test('existing client payer names and job payments are preserved', async () => {
  const f = fixture({
    guards: [{ user_id: 'guard-user', full_name: 'Alternative Guard Name' }],
    clients: [{ id: 'client-id', user_id: 'guard-user', company_name: 'Synthetic Events', contact_name: 'Client Contact' }],
  });
  await f.start();
  assert.match(content(f.subscriptionRow()), /Synthetic Events/);
  assert.doesNotMatch(content(f.subscriptionRow()), /Alternative Guard Name/);
  const jobRow = nodes(f.h.render()).find(n => n.type === 'tr' && content(n).includes('Job Payment'));
  assert.match(content(jobRow), /Synthetic Events.*£88\.00.*COMPLETED/);
  const contact = fixture({ clients: [{ user_id: 'guard-user', company_name: '', contact_name: 'Client Contact' }] });
  await contact.start();
  assert.match(content(contact.subscriptionRow()), /Client Contact/);
});

test('missing, blank or unreadable guard names retain an honest Unknown payer', async () => {
  for (const options of [{}, { guards: [{ user_id: 'guard-user', full_name: null }] }, { guards: [{ user_id: 'guard-user', full_name: '   ' }] }, { guardError: true }]) {
    const f = fixture(options); await f.start();
    assert.match(content(f.subscriptionRow()), /Unknown/);
    assert.match(content(f.subscriptionRow()), /£10\.00.*SUCCEEDED/);
  }
});
