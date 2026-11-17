import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canUseChristmasOffer,
  christmasOfferAmount,
  christmasOfferCheckoutParams,
  isChristmasOfferPrice,
} from '../supabase/functions/_shared/christmas-offer.mjs';

const duringOffer = Date.parse('2026-12-01T10:00:00Z');
const guard = { enabled: true, accountType: 'guard', planId: 'guard-pro', billingCycle: 'monthly' };
const client = { enabled: true, accountType: 'client', planId: 'client-pro', billingCycle: 'monthly' };

test('only the selected monthly Pro plans qualify while enabled', () => {
  assert.equal(christmasOfferAmount(guard, duringOffer), 1900);
  assert.equal(christmasOfferAmount(client, duringOffer), 9900);
  assert.equal(christmasOfferAmount({ ...guard, billingCycle: undefined }, duringOffer), 1900);
  for (const selection of [
    { enabled: false }, { accountType: 'client' }, { billingCycle: 'annual' },
    { billingCycle: '' }, { planId: 'guard-basic' }, { planId: 'guard-elite' },
  ]) {
    assert.equal(christmasOfferAmount({ ...guard, ...selection }, duringOffer), null);
  }
});

test('campaign starts on 1 December and closes at midnight starting 30 December', () => {
  const times = [
    ['2026-11-24T00:00:00.000Z', null],
    ['2026-11-30T23:59:59.999Z', null],
    ['2026-12-01T00:00:00.000Z', 1900],
    ['2026-12-29T23:59:59.999Z', 1900],
    ['2026-12-30T00:00:00.000Z', null],
    ['2026-12-31T00:00:00.000Z', null],
  ];
  for (const [time, amount] of times) assert.equal(christmasOfferAmount(guard, Date.parse(time)), amount, time);
  assert.equal(christmasOfferAmount(guard, NaN), null);
});

test('new and free accounts qualify, while paid history and founding subscriptions do not', () => {
  assert.equal(canUseChristmasOffer(null), true);
  for (const plan_slug of ['guard_starter', 'client_free']) {
    assert.equal(canUseChristmasOffer({ status: 'active', plan_slug }), true);
  }
  for (const subscription of [
    { status: 'active', plan_slug: 'client-pro' },
    { status: 'trialing', plan_slug: 'guard-pro' },
    { status: 'cancelled', stripe_subscription_id: 'sub_prior_paid' },
    { status: 'cancelled', plan_slug: 'founding-guard' },
  ]) {
    assert.equal(canUseChristmasOffer(subscription), false);
  }
});

test('Stripe price must be active, in GBP, and for one licensed month at the agreed price', () => {
  const price = {
    active: true, currency: 'gbp', unit_amount: 1900,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  };
  assert.equal(isChristmasOfferPrice(price, 1900), true);
  assert.equal(isChristmasOfferPrice(price, 9900), false);
  for (const changes of [
    { active: false }, { currency: 'usd' }, { recurring: null },
    { recurring: { ...price.recurring, interval: 'year' } },
    { recurring: { ...price.recurring, interval_count: 3 } },
    { recurring: { ...price.recurring, usage_type: 'metered' } },
  ]) {
    assert.equal(isChristmasOfferPrice({ ...price, ...changes }, 1900), false);
  }
});

test('Checkout requires a payment method and keeps the fixed first billing date for both prices', () => {
  for (const [amount, pounds] of [[1900, '19.00'], [9900, '99.00']]) {
    const params = christmasOfferCheckoutParams(amount);
    assert.equal(params.payment_method_collection, 'always');
    assert.equal(new Date(params.subscription_data.trial_end * 1000).toISOString(), '2027-01-01T00:00:00.000Z');
    assert.ok(params.custom_text.submit.message.includes(`£0 today. £${pounds} per month`));
  }
});
