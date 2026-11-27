import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareInboundTicketRequest } from '../lib/support-inbound-ticket-request.ts';
const input = {
 inboundEmailId: '12345678-1234-1234-1234-123456789abc',
 actorKind: 'client', actorId: 'abcd1234-1234-1234-1234-123456789abc',
 verificationMethod: 'authenticated_session', verificationEvidenceId: 'verified-session-reference',
 subject: 'Help with booking', bodyText: 'Please help',
};
test('accepts complete server-verified ticket request shape', () => {
 assert.equal(prepareInboundTicketRequest(input)?.actorKind, 'client');
});
test('rejects unknown actors and unverifiable evidence', () => {
 assert.equal(prepareInboundTicketRequest({...input, actorKind: 'unknown'}), null);
 assert.equal(prepareInboundTicketRequest({...input, verificationMethod: 'email_from_header'}), null);
 assert.equal(prepareInboundTicketRequest({...input, verificationEvidenceId: ''}), null);
 assert.equal(prepareInboundTicketRequest({...input, actorId: 'bad'}), null);
});
test('rejects empty and oversized ticket content', () => {
 assert.equal(prepareInboundTicketRequest({...input, subject: '   '}), null);
 assert.equal(prepareInboundTicketRequest({...input, bodyText: 'x'.repeat(20001)}), null);
});
