const { test } = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const owner = '11111111-1111-4111-8111-111111111111', requestId = '33333333-3333-4333-8333-333333333333';
function fixture(options = {}) {
  let handler, session, reservation, attached = false;let attachAttempts = 0;const calls = [];
  const plan = { name: 'Client Pro', audience: options.audience || 'client', stripe_price_id: 'price_month', stripe_annual_price_id: 'price_year', stripe_product_id: 'prod_client', monthly_price_pence: 9900, features: [] };
  const db = { auth: { getUser: async () => ({ data: { user: { id: owner, email: 'sandbox@example.invalid' } }, error: null }) },
    from(table) {
      const q = { select() { return q; }, eq() { return q; }, async maybeSingle() {
        return { error: null, data: table === 'plans' ? plan : table === 'clients' ? { id: owner, email: 'sandbox@example.invalid', stripe_customer_id: 'cus_existing' } : table === 'qg_token_redemptions' ? { id: reservation?.id, status: 'pending', stripe_checkout_session_id: session?.id } : null };
      } };return q;
    },
    async rpc(name, params) {
      calls.push([name, params]);
      if (name === 'reserve_qg_token_checkout') {
        if (options.disabled) return { error: { message: 'Token checkout is unavailable' }, data: null };
        reservation ||= { id: requestId, user_id: owner, tokens_used: 100, credit_pence: 1000, stripe_checkout_session_id: null, stripe_coupon_id: null, created_at: new Date().toISOString() };
        return { data: { ...reservation, stripe_checkout_session_id: attached ? session.id : null }, error: null };
      }
      if (name === 'attach_qg_token_checkout') { if (options.failAttach && attachAttempts++ === 0) { attached = options.attachSaved !== false;return { error: { message: 'Interrupted write' } }; } attached = true; }
      return { error: null, data: null };
    },
  };
  class Stripe {
    constructor() {
      this.prices = { retrieve: async id => ({ id, active: true, currency: 'gbp', product: 'prod_client', unit_amount: id === 'price_year' ? 99000 : 9900, recurring: { interval: id === 'price_year' ? 'year' : 'month', interval_count: 1 } }) };
      this.coupons = { create: async (params, key) => { calls.push(['coupon', params, key]);return { id: params.id }; } };
      this.checkout = { sessions: {
        create: async (params, key) => { calls.push(['session', params, key]);session ||= { id: 'cs_test_existing', url: 'https://checkout.stripe.com/c/pay/test_only', status: 'open', payment_status: 'unpaid', mode: 'subscription', client_reference_id: owner, metadata: params.metadata, total_details: { amount_discount: 1000 } };return session; },
        retrieve: async () => session,
        expire: async () => { calls.push(['expire']);session = { ...session, status: 'expired' };return session; },
      } };
    }
  }
  load('supabase/functions/create-subscription-checkout/index.ts', {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: fn => { handler = fn; } },
    'https://esm.sh/stripe@14.10.0?target=deno': { default: Stripe, __esModule: true },
    'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno': { createClient: () => db },
    '../_shared/payment-freeze.ts': { paymentFreezeResponse: async () => null },
  }, { Deno: { env: { get: name => name === 'QUICKGUARD_CHRISTMAS_OFFER_ENABLED' ? 'false' : 'sandbox-only' } } });
  return { calls, run: body => handler(new Request('https://sandbox.invalid/functions/v1/create-subscription-checkout', { method: 'POST', headers: { Authorization: 'Bearer QA', origin: 'https://quickguard.uk', 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'client-pro', billingCycle: 'monthly', ...body }) })) };
}
const redeem = { tokensToRedeem: 100, tokenCheckoutRequestId: requestId };

test('actual checkout handler leaves existing normal-price checkout unchanged when no tokens selected', async () => {
  const f = fixture();assert.equal((await f.run({})).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'coupon').length, 0);assert.equal(f.calls.filter(c => c[0].includes('qg_token')).length, 0);
  const session = f.calls.find(c => c[0] === 'session');assert.equal(session[1].discounts, undefined);assert.equal(session[2], undefined);
});
test('actual token checkout uses one-time product-bound coupon, server credit, stable keys and recoverable attachment', async () => {
  const f = fixture({ failAttach: true });assert.equal((await f.run(redeem)).status, 500);
  assert.equal((await f.run(redeem)).status, 200);assert.equal(f.calls.filter(c => c[0] === 'session').length, 1);
  const coupon = f.calls.find(c => c[0] === 'coupon');assert.equal(coupon[1].duration, 'once');assert.equal(coupon[1].amount_off, 1000);assert.deepEqual(coupon[1].applies_to.products, ['prod_client']);assert.equal(coupon[1].max_redemptions, 1);
  const session = f.calls.find(c => c[0] === 'session');assert.equal(session[1].metadata.qg_token_credit_pence, '1000');assert.match(session[2].idempotencyKey, /qg-token-session:/);
  assert.equal((await f.run({ cancelTokenCheckout: true, tokenCheckoutRequestId: requestId })).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'expire').length, 1);assert.ok(f.calls.some(c => c[0] === 'finish_qg_token_checkout' && c[1].p_expired));
});
test('disabled redemption, wrong audience and forged token counts fail before provider coupon/session writes', async () => {
  for (const options of [{ disabled: true }, { audience: 'guard' }]) {
    const f = fixture(options);assert.equal((await f.run(redeem)).status, 500);assert.ok(!f.calls.some(c => ['session', 'coupon'].includes(c[0])));
  }
  const f = fixture();assert.equal((await f.run({ ...redeem, tokensToRedeem: '100' })).status, 500);assert.equal(f.calls.length, 0);
});

test('lost attachment retries the identical provider operation without spending twice', async () => {
  const f = fixture({ failAttach: true, attachSaved: false });
  assert.equal((await f.run(redeem)).status, 500);assert.equal((await f.run(redeem)).status, 200);
  const sessions = f.calls.filter(c => c[0] === 'session');assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[0][1], sessions[1][1]);assert.deepEqual(sessions[0][2], sessions[1][2]);
});
