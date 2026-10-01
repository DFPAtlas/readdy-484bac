const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(name) {
  const source = fs.readFileSync(`supabase/functions/_shared/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', compiled)(module, module.exports);
  return module.exports;
}
const { bookingAmounts, applyClientPromotion, getBookingPolicy } = load('booking-policy');
const { matchesSubscriptionPrice } = load('subscription-price');
function database(subscription, rules, failure = false) {
  const queries = [];
  return { queries, from(table) {
    const query = { select() { return this; }, eq(key, value) { queries.push([table, key, value]); return this; },
      in() { return this; }, async maybeSingle() { return { data: table === 'subscriptions' ? subscription : rules, error: failure ? new Error('offline') : null }; } };
    return query;
  } };
}
const rule = percent => ({ platform_fee_percent: percent, platform_fee_fixed_pence: 0, payout_delay_days: 3, auto_release_hours: 72, dispute_window_hours: 48 });
for (const [plan, percent] of [['client_free', 15], ['client-starter', 10], ['client-pro', 7.5], ['client-enterprise', 5]]) {
  test(`${plan}: £100 guard pay, ${percent}% client fee, no guard deduction or surcharge`, async () => {
    const db = database(plan === 'client_free' ? null : { plan_slug: plan }, rule(percent));
    const policy = await getBookingPolicy(db, 'client');
    assert.equal(policy.planSlug, plan);
    assert.equal(policy.stripeFeePayer, 'quickguard');
    assert.equal(bookingAmounts(10000, policy.feePercent).clientTotalPence, 10000 + percent * 100);
    assert.equal(bookingAmounts(10000, policy.feePercent).guardNetPence, 10000);
    assert.equal(bookingAmounts(10000, policy.feePercent).stripeFeePence, 0);
    assert.ok(db.queries.some(q => q[1] === 'account_type' && q[2] === 'client'));
  });
}
test('round each assignment to pence, with no floating-point total drift', () => {
  assert.equal(bookingAmounts(1001, 7.5).platformFeePence, 75);
  assert.equal(bookingAmounts(999, 7.5).clientTotalPence, 1074);
  assert.throws(() => bookingAmounts(NaN, 15));
  assert.throws(() => bookingAmounts(0, 15));
});
test('missing, null, unknown and failed configuration cannot silently waive fees', async () => {
  await assert.rejects(getBookingPolicy(database(null, null), 'client'));
  await assert.rejects(getBookingPolicy(database(null, rule(null)), 'client'));
  await assert.rejects(getBookingPolicy(database({ plan_slug: 'unknown' }, rule(0)), 'client'));
  await assert.rejects(getBookingPolicy(database(null, rule(15), true), 'client'));
});
test('legacy free aliases map to Free; missing active subscription cannot use stale paid profile', async () => {
  assert.equal((await getBookingPolicy(database({ plan_slug: 'payg' }, rule(15)), 'client')).planSlug, 'client_free');
  assert.equal((await getBookingPolicy(database(null, rule(15)), 'client')).planSlug, 'client_free');
});
test('existing eligible launch, introductory and lifetime promotions are preserved', () => {
  const policy = { feePercent: 15, feeFixedPence: 0, isSubscribed: false };
  const client = { client_type: 'venue', client_signup_number: 1, client_promo_tier: 'launch_client', client_promo_jobs_remaining: 2 };
  const promo = applyClientPromotion(policy, client);
  assert.equal(promo.feePercent, 0);
  assert.equal(promo.jobsRemainingAfter, 1);
  assert.equal(client.client_promo_jobs_remaining, 2);
  assert.equal(applyClientPromotion(policy, { ...client, client_promo_jobs_remaining: 0, client_promo_ends_at: '2027-01-01' }, new Date('2026-10-01')).feePercent, 0);
  assert.equal(applyClientPromotion(policy, { ...client, client_promo_jobs_remaining: 0, client_lifetime_fee_discount: 0.5 }).feePercent, 7.5);
  assert.equal(applyClientPromotion(policy, { ...client, client_type: 'security_company' }).feePercent, 15);
  assert.equal(applyClientPromotion({ ...policy, isSubscribed: true }, client).feePercent, 15);
});
test('configured subscription price must match interval, currency, product and amount', () => {
  const plan = { stripe_product_id: 'product', monthly_price_pence: 4900 };
  const monthly = { active: true, currency: 'gbp', product: 'product', unit_amount: 4900, recurring: { interval: 'month', interval_count: 1 } };
  const annual = { ...monthly, unit_amount: 49000, recurring: { interval: 'year', interval_count: 1 } };
  assert.equal(matchesSubscriptionPrice(monthly, plan, 'monthly'), true);
  assert.equal(matchesSubscriptionPrice(annual, plan, 'annual'), true);
  assert.equal(matchesSubscriptionPrice(monthly, plan, 'annual'), false);
  for (const change of [{ active: false }, { currency: 'usd' }, { product: 'wrong' }, { unit_amount: 9900 }]) {
    assert.equal(matchesSubscriptionPrice({ ...monthly, ...change }, plan, 'monthly'), false);
  }
});
test('funded booking preview uses original snapshot after a plan/rate change', async () => {
  let handler;
  const records = { guards: null, clients: { id: 'client' }, jobs: { id: 'job', client_id: 'client', payment_status: 'funded' },
    payment_fee_breakdowns: { job_amount: 100, platform_fee: 10, platform_fee_percent: 10, stripe_fee_estimate: 1.85, stripe_fee_percent: 1.5,
      stripe_fee_payer: 'client', client_total_charge: 111.85, guard_payout_amount: 90, quickguard_net_fee: 20, tax_disclaimer_accepted: true } };
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, from(table) {
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: records[table] }) };
  } };
  let source = fs.readFileSync('supabase/functions/calculate-job-fees/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
  source = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('serve', 'createClient', 'Deno', 'getBookingPolicy', 'applyClientPromotion', 'bookingAmounts', source)(
    callback => handler = callback, () => db, { env: { get: () => 'configured' } },
    () => { throw new Error('Historical payment must never load current rates'); }, applyClientPromotion, bookingAmounts);
  const response = await handler(new Request('https://example.test', { method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify({ jobId: 'job' }) }));
  assert.equal(response.status, 200);
  const fees = await response.json();
  assert.equal(fees.clientTotalCharge, 111.85);
  assert.equal(fees.guardPayoutAmount, 90);
  assert.equal(fees.recordedPayment, true);
});
