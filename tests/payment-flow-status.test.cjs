const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
function loadFlow() {
  try { return require('../lib/payments/paymentFlowStatus.ts'); }
  catch (err) {
    if (err.code !== 'ERR_UNKNOWN_FILE_EXTENSION' && !(err instanceof SyntaxError)) throw err;
    const ts = require('typescript');
    const compiled = ts.transpileModule(fs.readFileSync('lib/payments/paymentFlowStatus.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    const mod = { exports: {} };
    new Function('module', 'exports', compiled)(mod, mod.exports);
    return mod.exports;
  }
}
const { getPaymentFlowStatus } = loadFlow();
const flow = (data = {}) => getPaymentFlowStatus({
  jobPaymentStatus: null, assignmentPaymentStatus: null, jobCurrency: 'GBP',
  jobAgreedAmount: null, assignmentPaymentAmount: null, jobGuardPayoutAmount: null,
  payoutNetAmount: null, payoutAmount: null, ...data
});
test('unpaid and unconfirmed states cannot be classified as complete by substring', () => {
  for (const status of ['unpaid', 'not_paid', 'payment_pending', 'awaiting_payment', 'incomplete', 'not_completed']) {
    assert.notEqual(flow({jobPaymentStatus: status}).job_secured.status, 'complete', status);
  }
  for (const status of ['unconfirmed', 'not_approved', 'awaiting_client_release']) {
    assert.notEqual(flow({completionRequestStatus: status}).client_released.status, 'complete', status);
  }
  for (const status of ['not_transferred', 'not_completed', 'payout_pending']) {
    assert.notEqual(flow({payoutStatus: status}).guard_paid.status, 'complete', status);
  }
});
test('exact successful aliases and normalized case still complete', () => {
  for (const status of ['paid', 'succeeded', 'completed', 'funded', 'PAID']) {
    assert.equal(flow({jobPaymentStatus: status}).job_secured.status, 'complete', status);
  }
  assert.equal(flow({payoutStatus: 'payout-paid'}).guard_paid.status, 'complete');
  assert.equal(flow({completionRequestStatus: 'client released'}).client_released.status, 'complete');
});
test('failure, refund and pending states retain their own classifications', () => {
  for (const status of ['failed', 'cancelled', 'refunded']) {
    assert.equal(flow({jobPaymentStatus: status}).job_secured.status, 'failed', status);
  }
  assert.equal(flow({jobPaymentStatus: 'processing'}).job_secured.status, 'pending');
  assert.equal(flow({payoutStatus: 'transfer_pending'}).guard_paid.status, 'pending');
  assert.equal(flow({payoutStatus: 'reversed'}).guard_paid.status, 'failed');
  assert.equal(flow({completionRequestStatus: 'disputed'}).client_released.status, 'failed');
});
test('zero amounts are preserved rather than replaced by another amount', () => {
  const result = flow({jobAgreedAmount: 0, assignmentPaymentAmount: 92, payoutNetAmount: 0, payoutAmount: 80});
  assert.equal(result.job_secured.amount, 0);
  assert.equal(result.guard_paid.amount, 0);
});
