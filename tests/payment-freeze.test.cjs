const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('freeze policy allows only an explicit false setting and fails closed otherwise', async () => {
  const { shouldBlockStripeOperation } = await import(
    '../supabase/functions/_shared/payment-freeze-policy.mjs'
  );

  assert.equal(shouldBlockStripeOperation('false', false), false);
  assert.equal(shouldBlockStripeOperation(undefined, false), true);
  assert.equal(shouldBlockStripeOperation('true', false), true);
  assert.equal(shouldBlockStripeOperation('unexpected', false), true);
  assert.equal(shouldBlockStripeOperation('false', true), true);
  assert.equal(shouldBlockStripeOperation(undefined, true), true);
});

test('every Stripe initiation route uses the shared freeze guard; webhooks remain available', () => {
  const guarded = [
    'create-subscription-checkout',
    'create-job-payment',
    'create-wizard-checkout',
    'cancel-subscription',
    'resume-subscription',
    'create-guard-payout',
    'create-connect-account',
    'create-guard-connect-account',
    'create-guard-onboarding-link',
    'admin-test-job-payment',
    'create-client-billing-portal',
    'retry-failed-payment',
    'process-overdue-guard-payouts',
    'resolve-dispute',
  ];

  for (const slug of guarded) {
    const source = fs.readFileSync(
      path.join(root, 'supabase/functions', slug, 'index.ts'),
      'utf8',
    );
    assert.match(source, /paymentFreezeResponse/, `${slug} must enforce payment freeze`);
  }

  for (const slug of ['enhanced-stripe-webhook', 'stripe-bank-payout-webhook']) {
    const source = fs.readFileSync(
      path.join(root, 'supabase/functions', slug, 'index.ts'),
      'utf8',
    );
    assert.doesNotMatch(source, /paymentFreezeResponse/, `${slug} must remain available during the freeze`);
  }
});
