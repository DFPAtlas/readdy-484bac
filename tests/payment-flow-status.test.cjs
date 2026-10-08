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

test('stage labels do not claim approval or payment before those stages complete', () => {
  const funded = flow({ jobPaymentStatus: 'funded' });
  assert.equal(funded.client_released.label, 'Completion Not Submitted');
  assert.equal(funded.guard_paid.label, 'Not Paid Yet');

  const awaitingApproval = flow({ jobPaymentStatus: 'funded', completionRequestStatus: 'pending' });
  assert.equal(awaitingApproval.client_released.label, 'Awaiting Client Approval');
  assert.equal(awaitingApproval.guard_paid.label, 'Not Paid Yet');

  const payoutPending = flow({ completionRequestStatus: 'approved', payoutStatus: 'pending' });
  assert.equal(payoutPending.client_released.label, 'Client Approved');
  assert.equal(payoutPending.guard_paid.label, 'Payout Processing');
});

function loadReturnStatus() {
  const source = fs.readFileSync('app/client/payment/success/page.tsx', 'utf8');
  const start = source.indexOf('(jobData: JobSummary | null, assignmentData: AssignmentSummary[], txnData: Transaction | null): PageStatus =>');
  const end = source.indexOf('\n    []', start);
  const expression = source.slice(start, end).trim().replace(/,$/, '');
  const code = 'const derive = ' + expression + ';';
  let compiled;
  try {
    compiled = require('node:module').stripTypeScriptTypes(code);
  } catch {
    compiled = require('typescript').transpileModule(code, {
      compilerOptions: { module: require('typescript').ModuleKind.CommonJS }
    }).outputText;
  }
  const confirmation = (job, assignments) =>
    job.status === 'confirmed' && job.payment_status === 'funded' &&
    assignments.length > 0 && assignments.every(a => a.status === 'confirmed' && a.payment_status === 'funded')
      ? 'confirmed' : job.payment_status === 'funded' ? 'reconciling' : 'awaiting_payment';
  return new Function('computeBookingConfirmation', compiled + '; return derive;')(confirmation);
}
const deriveReturn = loadReturnStatus();
const confirmedJob = {status: 'confirmed', payment_status: 'funded'};
const confirmedAssignments = [{status: 'confirmed', payment_status: 'funded'}];
test('checkout return cannot confirm a booking without its matching completed transaction', () => {
  assert.equal(deriveReturn(confirmedJob, confirmedAssignments, null), 'reconciling');
  assert.equal(deriveReturn(confirmedJob, confirmedAssignments, {status: 'pending'}), 'reconciling');
  assert.equal(deriveReturn(confirmedJob, confirmedAssignments, {status: 'completed'}), 'paid');
});
test('checkout return waits for guards and reports failed payments', () => {
  assert.equal(deriveReturn(confirmedJob, [], {status: 'completed'}), 'reconciling');
  assert.equal(deriveReturn({status: 'awaiting_payment', payment_status: 'pending'}, [], {status: 'pending'}), 'confirming');
  assert.equal(deriveReturn(confirmedJob, confirmedAssignments, {status: 'failed'}), 'failed');
  assert.equal(deriveReturn(null, [], null), 'error');
});
