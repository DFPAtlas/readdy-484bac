import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { candidateFromSubject, isAllowedSupportRecipient, normaliseMailbox, safePlainText } from '../lib/support-inbound-email.ts';

test('accepts only exact QuickGuard support recipient', () => {
  assert.equal(isAllowedSupportRecipient(['support@quickguard.uk']), true);
  assert.equal(isAllowedSupportRecipient(['support@quickguard.uk.evil.test']), false);
  assert.equal(isAllowedSupportRecipient('support@quickguard.uk'), false);
});
test('normalises display-name sender and rejects malformed addresses', () => {
  assert.equal(normaliseMailbox('Customer <User@Example.com>'), 'user@example.com');
  assert.equal(normaliseMailbox('nobody'), null);
});
test('does not match random subject text as a ticket', () => {
  assert.deepEqual(candidateFromSubject('Cannot log in'), { reference: null, reason: 'none' });
  assert.deepEqual(candidateFromSubject('Re: QG-TICKET-AB12345'), { reference: 'AB12345', reason: 'explicit_reference' });
});
test('limits text size and strips null characters', () => {
  assert.equal(safePlainText('x\0y'), 'xy');
  assert.equal(safePlainText('x'.repeat(30000)).length, 20000);
});
