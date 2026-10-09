const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');

test('Checkout lets Stripe Dashboard control eligible payment methods', () => {
  for (const path of [
    'supabase/functions/create-job-payment/index.ts',
    'supabase/functions/admin-test-job-payment/index.ts',
  ]) {
    assert.doesNotMatch(read(path), /payment_method_types\s*:/, path);
  }
});

test('Checkout fulfillment waits for payment and handles asynchronous outcomes', () => {
  const source = read('supabase/functions/enhanced-stripe-webhook/index.ts');
  assert.match(source, /case 'checkout\.session\.completed':\s*case 'checkout\.session\.async_payment_succeeded':/);
  assert.match(source, /event\.type === 'checkout\.session\.completed' && session\.payment_status === 'unpaid'/);
  assert.match(source, /case 'checkout\.session\.async_payment_failed':/);
  assert.match(source, /await failJobPayment\(appSupabase, supabaseUrl, supabaseKey, session\)/);

  const unpaidGuard = source.indexOf("session.payment_status === 'unpaid'");
  const fulfillment = source.indexOf('if (isJobPayment) await finalizeJobPayment');
  assert.ok(unpaidGuard >= 0 && fulfillment > unpaidGuard, 'unpaid guard must run before job fulfillment');

  const failureHelper = source.slice(
    source.indexOf('async function failJobPayment'),
    source.indexOf('async function finalizeJobAfterPayout'),
  );
  assert.match(failureHelper, /status: 'failed'/);
  assert.match(failureHelper, /payment_status: 'failed'/);
  assert.match(failureHelper, /\.eq\('stripe_session_id', sessionId\)/);
});

test('live-mode checks recognise least-privilege restricted keys', () => {
  const readiness = read('supabase/functions/launch-readiness/index.ts');
  const payout = read('supabase/functions/stripe-bank-payout-webhook/index.ts');
  assert.match(readiness, /\(\?:sk\|rk\)_live_/);
  assert.match(readiness, /\(\?:sk\|rk\)_test_/);
  assert.match(payout, /\(\?:sk\|rk\)_live_/);
  assert.doesNotMatch(payout, /stripeKey\.startsWith\('sk_live_'\)/);
});

test('live cutover runbook separates platform and connected-account controls', () => {
  const runbook = read('lib/STRIPE_LIVE_CUTOVER.md');
  assert.match(runbook, /checkout\.session\.async_payment_succeeded/);
  assert.match(runbook, /checkout\.session\.async_payment_failed/);
  assert.match(runbook, /events on connected accounts/);
  assert.match(runbook, /bank_payout_webhook_keys/);
  assert.match(runbook, /Do not use Stripe test card numbers in live mode/);
  assert.doesNotMatch(runbook, /4242 4242 4242 4242/);
  assert.match(runbook, /Never restore a whole pre-cutover database/);
});
