const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

const checkedLicence = '1234567890123456';
const check = {
  id: 'check', reason: 'manual', status: 'done', decision: 'approve',
  reasons: [], warnings: [], error: null, sia_found: true,
  licence_number: checkedLicence, expected_first_name: 'Synthetic', expected_surname: 'Guard',
  sia_first_name: 'Synthetic', sia_surname: 'Guard', sia_status: 'ACTIVE',
  sia_sector: 'Security Guarding', sia_role: 'Front Line', sia_expiry: '2028-01-14',
  created_at: '2026-11-16T18:53:42Z', checked_at: '2026-11-16T18:53:45Z',
};
function fixture(licence, checks = [check], readError = false) {
  const reads = [];
  const db = { from(table) {
    const read = { table, filters: [] }; reads.push(read);
    const q = { select() { return q; }, eq(key, value) { read.filters.push([key, value]); return q; }, order() { return q; }, limit() { return q; },
      then(resolve, reject) { return Promise.resolve({ data: checks, error: readError ? { message: 'Read unavailable' } : null }).then(resolve, reject); } };
    return q;
  }, functions: { invoke() { throw new Error('Read-only rendering must not invoke a worker'); } } };
  const h = hooksHarness('app/admin/guard-verifications/SiaRegisterCheckPanel.tsx', { '@/lib/supabase': { supabase: db } });
  const guard = { id: 'guard', sia_licence_number: licence, licence_types: ['Security Guarding'] };
  return { h, reads, render() { return h.render({ guard }); }, async start() { this.render(); await h.effects(); } };
}
const headerBadge = tree => nodes(tree).find(n => n.type === 'span' && n.props.className?.includes('px-2.5 py-1 rounded-full'));

test('a previous approve result for a different licence is historical, with distinct current and checked numbers', async () => {
  const current = '9876543210987654';
  const f = fixture(current); await f.start(); const tree = f.render();
  assert.equal(content(headerBadge(tree)), 'Historical check');
  assert.doesNotMatch(headerBadge(tree).props.className, /emerald/);
  assert.match(content(tree), /Current profile licence9876543210987654/);
  assert.match(content(tree), /Licence submitted for this check1234567890123456/);
  assert.match(content(tree), /does not verify the current profile licence/);
  assert.match(content(tree), /Check history.*Approve/);
  assert.deepEqual(f.reads[0].filters, [['subject_type', 'guard'], ['subject_id', 'guard']]);
});

test('whitespace-only formatting differences retain the real result and raw displayed values', async () => {
  const f = fixture('1234 5678 9012 3456'); await f.start(); const tree = f.render();
  assert.equal(content(headerBadge(tree)), 'Approve');
  assert.doesNotMatch(content(tree), /Historical check|does not verify the current profile licence/);
  assert.match(content(tree), /Current profile licence1234 5678 9012 3456/);
  assert.match(content(tree), /Licence submitted for this check1234567890123456/);
});

test('missing or invalid current/checked numbers cannot give current positive evidence', async () => {
  for (const [current, recorded] of [['', checkedLicence], [checkedLicence, null], [checkedLicence, ''], ['x1234567890123456', checkedLicence], [checkedLicence, '123456789012345']]) {
    const f = fixture(current, [{ ...check, licence_number: recorded }]); await f.start();
    assert.equal(content(headerBadge(f.render())), 'Historical check');
  }
});

test('a not-found result never repeats the submitted licence as a value returned by the register', async () => {
  const f = fixture(checkedLicence, [{ ...check, decision: 'reject', sia_found: false, sia_first_name: null, sia_surname: null, sia_status: null, sia_sector: null, sia_role: null, sia_expiry: null }]);
  await f.start(); const tree = f.render();
  assert.equal(content(headerBadge(tree)), 'Reject');
  assert.match(content(tree), /Not found on register/);
  assert.equal(nodes(tree).filter(n => typeof n.type === 'function' && n.props.label === 'Licence number').length, 0);
  assert.match(content(tree), /Licence submitted for this check1234567890123456/);
});

test('empty history does not claim a check is running, while real pending history does', async () => {
  const empty = fixture(checkedLicence, []);
  assert.equal(content(headerBadge(empty.render())), 'Loading checks');
  await empty.h.effects();
  assert.equal(content(headerBadge(empty.render())), 'No check recorded');
  assert.match(content(empty.render()), /No register checks recorded/);
  const pending = fixture(checkedLicence, [{ ...check, status: 'pending', decision: null }]); await pending.start();
  assert.equal(content(headerBadge(pending.render())), 'Check in progress');
});

test('a failed read is unavailable evidence rather than an empty history or positive result', async () => {
  const f = fixture(checkedLicence, [check], true); await f.start(); const tree = f.render();
  assert.equal(content(headerBadge(tree)), 'Check unavailable');
  assert.doesNotMatch(content(tree), /No register checks recorded|Check history|SIA register shows/);
  assert(nodes(tree).some(n => n.props?.role === 'alert' && content(n) === 'Read unavailable'));
});
