import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validTicketReference, validUuid, isSupportAdmin, isReviewOnlyAction } from '../lib/support-email-review-validation.ts';

test('ticket reference is an exact, bounded identifier, not a substring or SQL-like input', () => {
 assert.equal(validTicketReference(' qg-abc123 '), 'QG-ABC123');
 for (const invalid of ['', 'xx', 'QG-123;DROP', 'QG 123', 'a'.repeat(61), null])
  assert.equal(validTicketReference(invalid), null);
});
test('only strict UUID values can request an attachment', () => {
 assert.equal(validUuid('12345678-1234-1234-1234-123456789abc'), true);
 for (const invalid of [null, '12345678', '12345678-1234-1234-1234-123456789abc;DROP'])
  assert.equal(validUuid(invalid), false);
});
test('only active support admins have triage access', () => {
 assert.equal(isSupportAdmin('admin', true), true);
 assert.equal(isSupportAdmin('super_admin', true), true);
 for (const role of ['guard', 'client', 'finance_admin', 'admin_user', null])
  assert.equal(isSupportAdmin(role, true), false);
 assert.equal(isSupportAdmin('admin', false), false);
});
test('unknown or write-capable future actions fail closed', () => {
 for (const action of ['list','lookup_ticket','attach','reject'])
  assert.equal(isReviewOnlyAction(action), true);
 for (const action of ['publish','send','create_ticket',null])
  assert.equal(isReviewOnlyAction(action), false);
});
