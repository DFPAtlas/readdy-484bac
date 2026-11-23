const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content, flush } = require('./helpers/guard-ui-fixture.cjs');
const id = '58ea2b87-c8e7-484b-a97e-e8d0eccfdaae';
const props = { subscriptionId: id, currency: 'gbp' };
const response = (result = {}) => ({ data: { success: true, results: [{ sub_id: id, action: 'preview', invoice_id: 'in_fixture', amount: 10, already_recorded: true, ...result }] }, error: null });
function setup(result = response(), session = true) {
  const calls = [];
  const db = { auth: { async getSession() { return { data: { session: session ? {} : null }, error: null }; } },
    functions: { async invoke(name, options) { calls.push({ name, ...options }); return typeof result === 'function' ? result() : result; } } };
  const h = hooksHarness('app/admin/payments/SubscriptionInvoicePreview.tsx', { '@/lib/supabase': { supabase: db } });
  const render = (p = props) => h.render(p);
  const click = (p = props) => nodes(render(p)).find(n => n.type === 'button').props.onClick();
  return { h, calls, render, click };
}
test('invoice preview sends only the selected subscription and dry_run, and distinguishes recorded, missing and zero-value invoices', async () => {
  for (const [result, expected] of [[{}, /Already recorded/], [{ already_recorded: false }, /Missing from payment history/], [{ amount: 0, already_recorded: false }, /Zero-value invoice/]]) {
    const f = setup(response(result)); f.render(); await f.h.effects(); await f.click();
    assert.deepEqual(f.calls, [{ name: 'backfill-subscription-payments', body: { subscription_id: id, dry_run: true } }]);
    const text = content(f.render()); assert.match(text, expected); assert.match(text, /No records changed/); assert.match(text, /GBP/);
  }
});
test('invoice preview rejects missing auth, denied, empty, partial, mismatched and malformed results', async () => {
  const invalid = [
    { data: null, error: { message: 'Forbidden' } },
    { data: { success: true, results: [] }, error: null },
    { data: { success: false, results: [{ sub_id: id, action: 'error' }] }, error: null },
    response({ sub_id: 'another-subscription' }), response({ action: 'backfilled' }),
    response({ amount: '10' }), response({ amount: -1 }), response({ amount: NaN }),
    response({ already_recorded: 'true' }), response({ invoice_id: '' }),
    { data: { success: true, results: [response().data.results[0], response().data.results[0]] }, error: null },
  ];
  for (const result of invalid) {
    const f = setup(result); f.render(); await f.h.effects(); await f.click();
    const tree = f.render(); assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
    assert.doesNotMatch(content(tree), /Already recorded|Missing from payment history/);
    assert.match(content(tree), /Retry invoice preview/);
  }
  const f = setup(response(), false); f.render(); await f.h.effects(); await f.click();
  assert.equal(f.calls.length, 0); assert.match(content(f.render()), /session is unavailable/);
});
test('skipped unpaid invoices remain distinct from a successful paid preview', async () => {
  const f = setup(response({ action: 'skipped', reason: 'latest invoice is not paid' }));
  f.render(); await f.h.effects(); await f.click();
  assert.match(content(f.render()), /No paid invoice preview: latest invoice is not paid/);
  assert.doesNotMatch(content(f.render()), /Already recorded/);
});
test('retry clears previous positive evidence while pending and prevents overlapping requests', async () => {
  let resolve, count = 0; const waiting = new Promise(r => resolve = r);
  const f = setup(() => ++count === 1 ? response() : waiting);
  f.render(); await f.h.effects(); await f.click(); assert.match(content(f.render()), /Already recorded/);
  const pending = f.click(); await flush(); await f.click();
  assert.equal(f.calls.length, 2); assert.doesNotMatch(content(f.render()), /Already recorded|in_fixture/);
  resolve({ data: null, error: { message: 'Unavailable' } }); await pending;
  assert.match(content(f.render()), /Retry invoice preview/); assert.doesNotMatch(content(f.render()), /Already recorded/);
});
test('closed or changed payment details cannot receive a late invoice result', async () => {
  for (const change of [false, true]) {
    let resolve; const waiting = new Promise(r => resolve = r); const f = setup(() => waiting);
    f.render(); await f.h.effects(); const pending = f.click(); await flush();
    if (change) { f.render({ ...props, subscriptionId: '00000000-0000-0000-0000-000000000001' }); await f.h.effects(); }
    else f.h.unmount();
    const writes = f.h.writes; resolve(response()); await pending; assert.equal(f.h.writes, writes);
  }
});
test('missing or invalid subscription links cannot start a request', async () => {
  for (const subscriptionId of [undefined, null, '', 'sub_provider_id']) {
    const f = setup(), p = { ...props, subscriptionId }; f.render(p); await f.h.effects();
    assert.equal(nodes(f.render(p)).find(n => n.type === 'button').props.disabled, true);
    await f.click(p); assert.equal(f.calls.length, 0); assert.match(content(f.render(p)), /no valid subscription link/);
  }
});
test('payment details expose preview for subscriptions only, using the local subscription link', async () => {
  const payment = { id: 'payment', subscription_id: id, user_id: 'user', currency: 'gbp', amount: 10, status: 'succeeded', created_at: '2026-11-05' };
  const db = { from(table) { const q = { select: () => q, not: () => q, order: () => q, limit: () => q, in: () => q,
    then(resolve, reject) { return Promise.resolve({ data: table === 'subscription_payments' ? [payment] : [], error: null }).then(resolve, reject); } }; return q; } };
  const h = hooksHarness('app/admin/payments/page.tsx', { '@/lib/supabase': { supabase: db }, '../payments-jobs/RefundRequestQueue': { __esModule: true, default: () => null } });
  h.render(); await h.effects();
  nodes(h.render()).find(n => n.type === 'button' && content(n) === 'View').props.onClick();
  const preview = nodes(h.render()).find(n => typeof n.type === 'function' && n.type.name === 'SubscriptionInvoicePreview');
  assert.equal(preview.props.subscriptionId, id); assert.equal(preview.props.currency, 'gbp');
});
