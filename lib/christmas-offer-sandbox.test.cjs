'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const POLICY_FILE = path.join(ROOT, 'lib/christmas-offer-sandbox/policy.mjs');
const DRAFT_FUNCTION = 'lib/christmas-offer-sandbox/checkout-function.ts.txt';
const LIVE_CHECKOUT = 'supabase/functions/create-subscription-checkout/index.ts';
const WIZARD_CHECKOUT = 'supabase/functions/create-wizard-checkout/index.ts';

const GOOD_GATE = { enabled: true, code: 'sandbox_ready', message: 'ok', testOnly: true };

let policy;

test.before(async () => {
  policy = await import(pathToFileURL(POLICY_FILE).href);
});

const eligible = (overrides = {}) => policy.evaluateChristmasOffer({
  now: '2026-12-01T12:00:00.000Z',
  planId: 'guard-pro',
  accountType: 'guard',
  billingCycle: 'monthly',
  subscription: null,
  sandbox: GOOD_GATE,
  ...overrides,
});

const gate = (overrides = {}) => policy.evaluateSandboxConfig({
  enabledFlag: 'true',
  configuredProjectRef: 'abcdefghijklmnopqrst',
  runningProjectRef: 'abcdefghijklmnopqrst',
  stripeAccountId: 'acct_1SYmuoIMkpwfAEDT',
  stripeLivemode: false,
  ...overrides,
});

test('first charge is 1 January 2027 UK time and matches its epoch seconds', () => {
  assert.equal(policy.CHRISTMAS_OFFER.firstChargeIso, '2027-01-01T00:00:00.000Z');
  assert.equal(policy.CHRISTMAS_OFFER.firstChargeAt, 1798761600);
  assert.equal(Date.parse(policy.CHRISTMAS_OFFER.firstChargeIso) / 1000, policy.CHRISTMAS_OFFER.firstChargeAt);
});

test('offer opens at 00:00 UK time on 24 November 2026', () => {
  assert.equal(policy.CHRISTMAS_OFFER.offerStartIso, '2026-11-24T00:00:00.000Z');
  assert.equal(eligible({ now: '2026-11-24T00:00:00.000Z' }).eligible, true);
  const early = eligible({ now: '2026-11-23T23:59:59.000Z' });
  assert.equal(early.eligible, false);
  assert.equal(early.code, 'offer_not_started');
});

test('offer closes at 00:00 UK time on 30 December 2026, exclusive', () => {
  assert.equal(policy.CHRISTMAS_OFFER.offerEndIso, '2026-12-30T00:00:00.000Z');
  assert.equal(policy.CHRISTMAS_OFFER.offerEndExclusive, true);
  assert.doesNotMatch(policy.CHRISTMAS_OFFER.offerEndIso, /12-31/);
  assert.equal(eligible({ now: '2026-12-29T23:59:59.998Z' }).eligible, true);
  assert.equal(eligible({ now: '2026-12-29T23:59:59.999Z' }).eligible, true);
  const cases = [
    '2026-12-30T00:00:00.000Z',
    '2026-12-30T00:00:00.001Z',
    '2026-12-30T12:00:00.000Z',
    '2026-12-31T23:59:59.999Z',
    '2027-01-01T00:00:01.000Z',
  ];
  for (const now of cases) {
    const result = eligible({ now });
    assert.equal(result.eligible, false, `${now} must not be eligible`);
    assert.equal(result.code, 'offer_ended', `${now} must return offer_ended`);
    assert.match(result.message, /29 December 2026 was the last sign-up day/);
  }
});

test('the last supported test sign-up is 23:59:59.999 UK time on 29 December 2026', () => {
  assert.equal(policy.CHRISTMAS_OFFER.lastSupportedCheckoutIso, '2026-12-29T23:59:59.999Z');
  assert.equal(eligible({ now: '2026-12-29T23:59:59.999Z' }).eligible, true);
  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-29T23:59:59.999Z'), false);
});

test('the Stripe 48 hour minimum stays an independent check from the business cutoff', () => {
  assert.equal(policy.CHRISTMAS_OFFER.stripeMinimumBoundaryIso, '2026-12-30T00:00:00.000Z');
  const lead =
    Date.parse(policy.CHRISTMAS_OFFER.firstChargeIso) / 1000 -
    Date.parse(policy.CHRISTMAS_OFFER.stripeMinimumBoundaryIso) / 1000;
  assert.equal(lead, policy.CHRISTMAS_OFFER.stripeMinTrialLeadSeconds);
  assert.equal(lead, 172800);

  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-30T00:00:00.000Z'), false, 'exactly 48 hours satisfies at least 48 hours');
  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-30T00:00:00.999Z'), false);
  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-30T00:00:01.000Z'), true);
  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-31T00:00:00.000Z'), true);
  assert.equal(policy.trialEndOutsideStripeMinimum('2027-01-02T00:00:00.000Z'), true);
  assert.equal(policy.trialEndOutsideStripeMinimum('not-a-date'), true);
  assert.equal(policy.trialEndOutsideStripeMinimum(undefined), true);

  const boundary = eligible({ now: '2026-12-30T00:00:00.000Z' });
  assert.equal(boundary.code, 'offer_ended', 'the business cutoff still excludes midnight on 30 December even though Stripe would accept it');
  assert.equal(policy.trialEndOutsideStripeMinimum('2026-12-30T00:00:00.000Z'), false);
});

test('no early charge is ever possible, whatever the clock says', () => {
  assert.equal(policy.CHRISTMAS_OFFER.firstChargeAt, 1798761600);
  assert.equal(Date.parse(policy.CHRISTMAS_OFFER.firstChargeIso) / 1000, 1798761600);
  const source = read(DRAFT_FUNCTION);
  assert.match(source, /trial_end: CHRISTMAS_OFFER\.firstChargeAt/);
  assert.doesNotMatch(source, /trial_end:\s*(?:'now'|Math\.floor\(Date\.now\(\)\s*\/\s*1000\))/);
  assert.match(source, /payment_method_collection: 'always'/);
  for (const now of ['2026-11-24T00:00:00.000Z', '2026-12-01T12:00:00.000Z', '2026-12-29T23:59:59.999Z']) {
    assert.equal(policy.trialEndOutsideStripeMinimum(now), false);
  }
});

test('unreadable clocks fail closed', () => {
  const result = eligible({ now: 'not-a-date' });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'invalid_clock');
  assert.equal(policy.evaluateOfferTiming(undefined).code, 'invalid_clock');
});

test('only monthly Guard Pro and Client Pro qualify', () => {
  assert.equal(policy.evaluateOfferPlan({ planId: 'guard-pro', accountType: 'guard', billingCycle: 'monthly' }).ok, true);
  assert.equal(policy.evaluateOfferPlan({ planId: 'client-pro', accountType: 'client', billingCycle: 'monthly' }).ok, true);
  for (const planId of ['guard-basic', 'guard-elite', 'client-starter', 'client-enterprise', 'unknown-plan', '']) {
    const result = policy.evaluateOfferPlan({ planId, accountType: planId.startsWith('client') ? 'client' : 'guard', billingCycle: 'monthly' });
    assert.equal(result.ok, false, `${planId} must not qualify`);
    assert.equal(result.code, 'plan_not_eligible');
  }
});

test('annual billing never takes the offer path', () => {
  const result = policy.evaluateOfferPlan({ planId: 'guard-pro', accountType: 'guard', billingCycle: 'annual' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'billing_cycle_not_eligible');
  assert.equal(eligible({ billingCycle: 'annual' }).code, 'billing_cycle_not_eligible');
});

test('plan and account type must match', () => {
  const result = policy.evaluateOfferPlan({ planId: 'client-pro', accountType: 'guard', billingCycle: 'monthly' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'account_type_mismatch');
  assert.equal(eligible({ planId: 'client-pro', accountType: 'guard' }).code, 'account_type_mismatch');
});

test('catalogue amounts stay at 1900 and 9900 pence', () => {
  assert.equal(policy.CHRISTMAS_OFFER.plans['guard-pro'].monthlyPricePence, 1900);
  assert.equal(policy.CHRISTMAS_OFFER.plans['client-pro'].monthlyPricePence, 9900);
  assert.deepEqual(policy.offerPlanList().map((plan) => plan.slug).sort(), ['client-pro', 'guard-pro']);
});

test('existing paid, trialling and founding accounts are excluded', () => {
  const cases = [
    { status: 'active', planSlug: 'guard-basic', stripeSubscriptionId: 'sub_1' },
    { status: 'trialing', planSlug: 'guard-pro', stripeSubscriptionId: 'sub_2' },
    { status: 'past_due', planSlug: 'guard-pro', stripeSubscriptionId: 'sub_3' },
    { status: 'incomplete', planSlug: 'guard-pro', stripeSubscriptionId: 'sub_4' },
    { status: 'active', planSlug: 'guard-founding-2025', stripeSubscriptionId: 'sub_5' },
  ];
  for (const subscription of cases) {
    const result = eligible({ subscription });
    assert.equal(result.eligible, false, JSON.stringify(subscription));
    assert.ok(['existing_paid_or_trialing', 'existing_founding_offer'].includes(result.code));
  }
});

test('cancelled accounts with no live Stripe subscription remain eligible', () => {
  const result = eligible({ subscription: { status: 'canceled', planSlug: 'guard-pro', stripeSubscriptionId: null } });
  assert.equal(result.eligible, true);
});

test('the promotion is off unless explicitly enabled', () => {
  assert.equal(gate({ enabledFlag: '' }).code, 'promo_disabled');
  assert.equal(gate({ enabledFlag: 'TRUE' }).code, 'promo_disabled');
  assert.equal(gate({ enabledFlag: '1' }).code, 'promo_disabled');
  assert.equal(gate({ enabledFlag: undefined }).code, 'promo_disabled');
  assert.equal(gate().enabled, true);
});

test('the production QuickGuard project can never enable the path', () => {
  const result = gate({ configuredProjectRef: 'vnywjfpkepjgclkbcmsj', runningProjectRef: 'vnywjfpkepjgclkbcmsj' });
  assert.equal(result.enabled, false);
  assert.equal(result.code, 'production_project_ref_rejected');
  assert.equal(gate({ configuredProjectRef: 'vnywjfpkepjgclkbcmsj' }).enabled, false);
});

test('the running backend must match the configured sandbox reference', () => {
  assert.equal(gate({ configuredProjectRef: '' }).code, 'missing_sandbox_project_ref');
  assert.equal(gate({ runningProjectRef: null }).code, 'missing_running_project_ref');
  const mismatch = gate({ configuredProjectRef: 'abcdefghijklmnopqrst', runningProjectRef: 'zyxwvutsrqponmlkjihg' });
  assert.equal(mismatch.enabled, false);
  assert.equal(mismatch.code, 'project_ref_mismatch');
});

test('Stripe must confirm the sandbox account in test mode', () => {
  assert.equal(gate({ stripeAccountId: null }).code, 'stripe_account_unverified');
  assert.equal(gate({ stripeAccountId: 'acct_1LIVEMODEOTHER1234' }).code, 'stripe_account_mismatch');
  assert.equal(gate({ stripeLivemode: true }).code, 'stripe_mode_unverified');
  assert.equal(gate({ stripeLivemode: null }).code, 'stripe_mode_unverified');
  assert.equal(gate({ stripeAccountId: null, stripeLivemode: true }).code, 'stripe_account_unverified');
});

test('eligibility never runs while the sandbox gate is closed', () => {
  const result = eligible({ sandbox: { enabled: false, code: 'promo_disabled', message: 'off', testOnly: true } });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'promo_disabled');
  const missing = policy.evaluateChristmasOffer({ now: '2026-12-01T12:00:00.000Z', planId: 'guard-pro', accountType: 'guard' });
  assert.equal(missing.code, 'not_eligible');
});

test('every preview result is labelled test only', () => {
  assert.equal(eligible().testOnly, true);
  assert.equal(eligible({ now: '2026-12-29T23:59:59.999Z' }).testOnly, true);
  assert.equal(eligible({ now: '2026-12-30T00:00:00.000Z' }).testOnly, true);
  assert.equal(gate().testOnly, true);
});

test('project refs are derived from the running backend URL only', () => {
  assert.equal(policy.deriveProjectRef('https://abcdefghijklmnopqrst.supabase.co'), 'abcdefghijklmnopqrst');
  assert.equal(policy.deriveProjectRef('https://abcdefghijklmnopqrst.supabase.in'), 'abcdefghijklmnopqrst');
  assert.equal(policy.deriveProjectRef('https://quickguard.uk'), null);
  assert.equal(policy.deriveProjectRef('not a url'), null);
  assert.equal(policy.deriveProjectRef(''), null);
  assert.equal(policy.deriveProjectRef(undefined), null);
});

test('checkout metadata is offer-scoped and never carries client flags', () => {
  const metadata = policy.buildOfferCheckoutMetadata({ projectRef: 'abcdefghijklmnopqrst', userId: 'user-1', accountType: 'guard', planId: 'guard-pro', planName: 'Guard Pro' });
  assert.equal(metadata.offer_id, 'christmas-2026-free-until-jan');
  assert.equal(metadata.sandbox_only, 'true');
  assert.equal(metadata.billing_cycle, 'monthly');
  assert.equal(metadata.first_charge_at, '2027-01-01T00:00:00.000Z');
  assert.equal(metadata.user_id, 'user-1');
  assert.equal(metadata.plan_slug, 'guard-pro');
  assert.equal(Object.keys(metadata).some((key) => /enabled|testMode|isSandbox|force/i.test(key)), false);
});

test('draft checkout reuses the shared validation and trusted guards', () => {
  const source = read(DRAFT_FUNCTION);
  assert.match(source, /payment_method_collection: 'always'/);
  assert.match(source, /trial_end: CHRISTMAS_OFFER\.firstChargeAt/);
  assert.match(source, /allow_promotion_codes: false/);
  assert.match(source, /paymentFreezeResponse/);
  assert.match(source, /matchesSubscriptionPrice/);
  assert.match(source, /buildOfferCheckoutMetadata/);
  assert.match(source, /evaluateChristmasOffer/);
  assert.match(source, /trialEndOutsideStripeMinimum/);
  assert.match(source, /price\.livemode !== false/);
  assert.match(source, /session\.livemode !== false/);
  assert.match(source, /sessions\.expire/);
});

test('draft checkout never offers a product, price or coupon creation path', () => {
  const source = read(DRAFT_FUNCTION);
  assert.doesNotMatch(source, /coupons\.create|promotionCodes\.create/);
  assert.doesNotMatch(source, /products\.create|prices\.create/);
  assert.match(source, /plans/);
});

test('draft checkout is authorised by the session, never by client flags', () => {
  const source = read(DRAFT_FUNCTION);
  assert.match(source, /authClient\.auth\.getUser\(token\)/);
  assert.match(source, /client_reference_id: user\.id/);
  assert.doesNotMatch(source, /body\?\.(enabled|testMode|isSandbox|sandbox|forcePromo|allowLive)/);
  assert.doesNotMatch(source, /req\.headers\.get\('host'\)|hostname === 'localhost'/);
  assert.match(source, /evaluateSandboxConfig/);
});

test('draft checkout keeps the authenticated and privileged clients separate', () => {
  const source = read(DRAFT_FUNCTION);
  assert.match(source, /createClient\(supabaseUrl, anonKey/);
  assert.match(source, /createClient\(supabaseUrl, serviceRoleKey/);
});

test('the live checkout functions keep their existing behaviour', () => {
  for (const file of [LIVE_CHECKOUT, WIZARD_CHECKOUT]) {
    const source = read(file);
    assert.doesNotMatch(source, /christmas/i, `${file} must not reference the Christmas offer`);
    assert.match(source, /mode: 'subscription'/);
  }
  const live = read(LIVE_CHECKOUT);
  assert.doesNotMatch(live, /payment_method_collection/);
  assert.doesNotMatch(live, /trial_end:/);
});

test('npm run test:unit executes this suite', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:unit'], /lib\/christmas-offer-sandbox\.test\.cjs/);
});