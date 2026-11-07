import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSupportReply } from '../lib/support-outbound-email.ts';

const valid = {
 ticketId: '12345678-1234-1234-1234-123456789abc',
 messageId: 'abcd1234-1234-1234-1234-123456789abc',
 recipient: 'CUSTOMER@EXAMPLE.COM', subject: 'Re: Ticket', body: 'Hello',
};
test('outbound job has stable idempotency key and normalizes destination', () => {
 const first = prepareSupportReply(valid);
 assert.equal(first?.recipient, 'customer@example.com');
 assert.equal(first?.idempotencyKey, prepareSupportReply(valid)?.idempotencyKey);
});
test('rejects missing identifiers, invalid destination and blank body', () => {
 assert.equal(prepareSupportReply({ ...valid, ticketId: 'bad' }), null);
 assert.equal(prepareSupportReply({ ...valid, recipient: 'foo bar@example.com' }), null);
 assert.equal(prepareSupportReply({ ...valid, recipient: 'foo@exampleXcom' }), null);
 assert.equal(prepareSupportReply({ ...valid, body: '  ' }), null);
 assert.equal(prepareSupportReply({ ...valid, body: 'x'.repeat(20001) }), null);
});
