const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync('lib/payments/guardPaymentDisplay.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);
const { deriveGuardPaymentDisplayStatus, sumPaidGuardPayouts } = mod.exports;

test('payout records remain authoritative', () => {
  assert.equal(deriveGuardPaymentDisplayStatus({ payoutStatus: 'paid_out', jobPaymentStatus: 'funded' }), 'paid_out');
  assert.equal(deriveGuardPaymentDisplayStatus({ payoutStatus: 'reversed', jobPaymentStatus: 'paid_out' }), 'reversed');
});

test('refunded and funded jobs are not mislabeled as payout pending', () => {
  assert.equal(deriveGuardPaymentDisplayStatus({ jobStatus: 'cancelled', jobPaymentStatus: 'refunded' }), 'refunded');
  assert.equal(deriveGuardPaymentDisplayStatus({ jobStatus: 'confirmed', jobPaymentStatus: 'funded' }), 'funded');
});

test('completion stages have explicit fallback labels', () => {
  assert.equal(deriveGuardPaymentDisplayStatus({ jobStatus: 'awaiting_client_approval', jobPaymentStatus: 'funded' }), 'awaiting_approval');
  assert.equal(deriveGuardPaymentDisplayStatus({ jobStatus: 'payout_approved', assignmentPaymentStatus: 'payout_pending' }), 'payout_pending');
});

test('lifetime earnings include only completed payouts and prefer net amounts', () => {
  assert.equal(sumPaidGuardPayouts([
    { status: 'paid_out', amount: 80, net_amount: 75 },
    { status: 'completed', amount: '25' },
    { status: 'pending', amount: 100 },
    { status: 'reversed', amount: 80 },
  ]), 100);
});
