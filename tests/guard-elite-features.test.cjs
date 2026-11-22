const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { jsPDF } = require('jspdf');
const { load } = require('./helpers/enterprise-module.cjs');
const statement = load('lib/guard-statement.ts');
const placement = load('lib/guard-placement.ts');
const token = load('supabase/functions/_shared/token-checkout.ts');
const payment = (date, status = 'paid', amount = 20) => ({ date, jobTitle: 'QA shift', clientName: 'QA client', grossAmount: amount + 2, platformFee: 2, netPayout: amount, transferStatus: status });

test('monthly statement uses UK month boundaries, recorded fees/status and only paid totals', () => {
  const rows = [payment('2026-06-30T23:30:00Z'), payment('2026-07-01T10:00:00Z', 'held', 99), payment('2026-06-30T20:00:00Z', 'paid', 1000)];
  const report = statement.guardStatement(rows, '2026-07');
  assert.equal(report.rows.length, 2);assert.ok(report.summary.some(s => s.includes('net £20.00')));assert.equal(report.rows[1][6], 'held');
  assert.ok(!JSON.stringify(report).includes('1000.00'));assert.equal(statement.guardStatement([], '2026-07').rows.length, 0);
  assert.throws(() => statement.guardStatement(rows, '2026-13'));assert.throws(() => statement.guardStatement([payment('2026-07-01', 'paid', NaN)], '2026-07'));
  const doc = new jsPDF({ orientation: 'landscape' });load('lib/report-pdf.ts').renderReportPdf(doc, report);
  assert.ok(doc.output().startsWith('%PDF-'));assert.ok(doc.output().includes('QA shift'));assert.ok(doc.output().includes('held'));
});

test('actual guard statement download confirms owner before and after rendering and blocks concurrent export', async () => {
  let owner = 'guard', renderResolve, saves = 0;const states = [];let slot = 0;const refs = [];
  const hooks = { ...React, useState(v) { return [typeof v === 'function' ? v() : v, value => states.push(value)]; }, useRef(v) { const i = slot++;return refs[i] || (refs[i] = { current: v }); }, useEffect(fn) { fn(); } };
  const Component = load('components/GuardStatementDownload.tsx', { react: hooks, '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user: { id: owner } } }) } } }, '@/lib/report-pdf': { createReportPdf: () => new Promise(r => { renderResolve = r; }) } }, { URL: { createObjectURL: () => 'blob:qa', revokeObjectURL() {} }, document: { createElement: () => ({ click() { saves++; } }) }, setTimeout() {} }).default;
  const tree = Component({ payments: [payment(new Date().toISOString())], ownerId: 'guard' });
  const button = tree.props.children.find(n => n?.type === 'button');button.props.onClick();await Promise.resolve();await Promise.resolve();
  button.props.onClick();owner = 'another-account';renderResolve(new Blob(['%PDF'], { type: 'application/pdf' }));await new Promise(r => setImmediate(r));
  assert.equal(saves, 0);assert.ok(states.some(v => typeof v === 'string' && v.includes('account changed')));
});

test('placement ranks boost then priority then rating without mutating explicit input order', async () => {
  const rows = [{ id: 'standard', rating: 5 }, { id: 'boost', profile_boost: true, rating: 3 }, { id: 'priority', profile_boost: true, priority_profile: true, rating: 2 }];
  assert.deepEqual([...rows].sort(placement.compareGuardPlacement).map(r => r.id), ['priority', 'boost', 'standard']);assert.equal(rows[0].id, 'standard');
  const db = { rpc: async (_, { p_guard_ids }) => ({ data: p_guard_ids.map(id => ({ id, profile_boost: true, priority_profile: false })), error: null }) };
  assert.equal((await placement.loadGuardPlacement(db, Array.from({ length: 401 }, (_, i) => '' + i))).size, 401);
  await assert.rejects(() => placement.loadGuardPlacement({ rpc: async () => ({ data: [{ id: 'foreign', profile_boost: true, priority_profile: true }], error: null }) }, ['owned']), /Invalid/);
});

test('token request rejects forged counts; only paid or expired provider sessions finish a reservation', async () => {
  assert.equal(token.tokenRequest({}), null);
  for (const n of [-1, 1.5, '20', 2 ** 40]) assert.throws(() => token.tokenRequest({ tokensToRedeem: n, tokenCheckoutRequestId: '123' }));
  const calls = [];const db = { rpc: async (name, params) => { calls.push({ name, params });return { error: null }; } };
  const session = { id: 'cs_test_1', mode: 'subscription', status: 'complete', payment_status: 'unpaid', client_reference_id: 'guard', metadata: { qg_token_redemption_id: 'reserved', qg_token_coupon_id: 'qgt_one', qg_token_credit_pence: '100' }, total_details: { amount_discount: 100 } };
  await token.finishTokenCheckout(db, session);assert.equal(calls.length, 0);
  await token.finishTokenCheckout(db, { ...session, payment_status: 'paid' });assert.equal(calls[0].params.p_paid, true);
  await assert.rejects(() => token.finishTokenCheckout(db, { ...session, payment_status: 'paid', total_details: { amount_discount: 1 } }), /discount mismatch/);
  await token.finishTokenCheckout(db, { ...session, status: 'expired' });assert.equal(calls[1].params.p_expired, true);
});

test('actual public guard list renders entitled placement first while retaining the client postcode filter', async () => {
  const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');
  const rows = [{ id: 'standard', full_name: 'Standard Guard', rating: 5, postcode_area: 'AL1', licence_types: [] }, { id: 'featured', full_name: 'Featured Guard', rating: 3, postcode_area: 'AL1', licence_types: [] }, { id: 'excluded', full_name: 'Wrong Area Guard', rating: 5, postcode_area: 'SW1', licence_types: [] }];
  const db = { from() { const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order: async () => ({ data: rows, error: null }) };return q; }, rpc: async () => ({ data: rows.map(r => ({ id: r.id, profile_boost: r.id !== 'standard', priority_profile: false })), error: null }) };
  const h = hooksHarness('app/find-a-guard/page.tsx', { '@/lib/supabase': { supabase: db }, 'next/navigation': { useSearchParams: () => new URLSearchParams('postcode=AL1') } });
  const Inner = h.render().props.children.type;h.renderComponent(Inner);await h.effects();
  const tree = h.renderComponent(Inner), text = content(tree);assert.ok(text.indexOf('Featured Guard') < text.indexOf('Standard Guard'));assert.ok(!text.includes('Wrong Area Guard'));assert.match(text, /Featured profile/);
  assert.equal(nodes(tree).filter(n => n.type === 'h3' && /Guard/.test(content(n))).length, 2);h.unmount();
});

test('actual statement control downloads a valid PDF for the selected month and permits an empty monthly statement', async () => {
  let saved;const { hooksHarness, nodes } = require('./helpers/guard-ui-fixture.cjs');
  const h = hooksHarness('components/GuardStatementDownload.tsx', { '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user: { id: 'guard' } }, error: null }) } } } }, { URL: { createObjectURL(blob) { saved = blob;return 'blob:qa'; }, revokeObjectURL() {} }, document: { createElement: () => ({ click() {} }) }, setTimeout() {} });
  const props = { payments: [], ownerId: 'guard' };h.render(props);await h.effects();
  const input = nodes(h.render(props)).find(n => n.props?.['aria-label'] === 'Statement month');input.props.onChange({ target: { value: '2026-06' } });
  const button = nodes(h.render(props)).find(n => n.type === 'button');await button.props.onClick();
  // The click handler intentionally schedules its async work; allow real dynamic import/render to finish.
  for (let i = 0; i < 20 && !saved; i++) await new Promise(r => setImmediate(r));
  assert.equal(saved?.type, 'application/pdf');assert.ok(saved.size > 1000);h.unmount();
});

test('token selector survives a same-account sign-in event but clears private balance on account change', async () => {
  const { hooksHarness, nodes } = require('./helpers/guard-ui-fixture.cjs');let callback;
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }), onAuthStateChange(fn) { callback = fn;return { data: { subscription: { unsubscribe() {} } } }; } },
    from() { const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: { user_type: 'guard' }, error: null }) };return q; },
    rpc: async () => ({ data: { enabled: true, new_subscription: true, balance: 200, pence_per_100: 1000, max_percent: 50, pending: null }, error: null }) };
  const h = hooksHarness('app/upgrade/page.tsx', { '@/lib/supabase': { supabase: db }, 'next/navigation': { useSearchParams: () => new URLSearchParams() }, '@/lib/entitlements': { getActivePlan: async () => ({ plan_slug: 'guard_starter', plan_name: 'Free', is_free_tier: true, features: [] }) }, '@/lib/use-public-pricing': { usePublicPricing: () => ({ plans: [], loading: false, error: null }) } });
  const Inner = h.render().props.children.type;h.renderComponent(Inner);await h.effects();
  let input = nodes(h.renderComponent(Inner)).find(n => n.props?.['aria-label'] === 'Tokens to redeem');assert.ok(input);input.props.onChange({ target: { value: '100' } });
  callback('SIGNED_IN', { user: { id: 'owner' } });input = nodes(h.renderComponent(Inner)).find(n => n.props?.['aria-label'] === 'Tokens to redeem');assert.equal(input.props.value, 100);
  callback('SIGNED_IN', { user: { id: 'other' } });assert.equal(nodes(h.renderComponent(Inner)).find(n => n.props?.['aria-label'] === 'Tokens to redeem'), undefined);h.unmount();
});
