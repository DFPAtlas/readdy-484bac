const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

const makeGuard = (id, status) => Object.freeze({ id, full_name: `Synthetic ${id}`, email: `${id}@example.test`,
  verification_status: status, phone: null, location: null, postcode: null, date_of_birth: null,
  sia_licence_number: null, sia_expiry_date: null, years_experience: null, hourly_rate: null,
  bio: null, certifications: [], available_days: [], profile_image_url: null, is_active: false,
  profile_completed: false, rating: null, total_reviews: null, total_jobs_completed: null,
  created_at: '2026-11-24T00:00:00Z', verified_at: null, rejected_at: null,
  rejection_reason: status === 'rejected' ? 'Synthetic reason' : null, user_id: `owner-${id}` });

async function page({ ok = true } = {}) {
  const records = Object.freeze([makeGuard('pending', 'pending'), makeGuard('unclassified', null),
    makeGuard('approved', 'approved'), makeGuard('rejected', 'rejected')]);
  const before = JSON.stringify(records), reads = [];
  const h = hooksHarness('app/admin/subscribers/page.tsx', {
    'next/link': { __esModule: true, default: () => null },
    '@/lib/supabase': { supabase: { auth: { async getSession() {
      return { data: { session: { access_token: 'synthetic-session' } } };
    } }, from() { throw new Error('Legacy subscriber views must never write guard or notification records'); } } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } },
    confirm() { throw new Error('A native confirm must not approve a guard'); },
    prompt() { throw new Error('A native prompt must not reject a guard'); },
    fetch: async (url, options) => {
      assert.equal(url, 'https://fixture.invalid/functions/v1/get-guards?status=all');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
      assert(options.method === undefined || options.method === 'GET');
      reads.push(url);
      return { ok, json: async () => ok ? { success: true, data: records } : { success: false, error: 'Unable to load subscribers' } };
    },
  });
  h.render(); await h.effects();
  return { h, records, reads, assertUnchanged() { assert.equal(JSON.stringify(records), before); } };
}

function links(tree) { return nodes(tree).filter(n => n.props?.href === '/admin/guard-verifications'); }
function decisionButtons(tree) {
  return nodes(tree).filter(n => n.type === 'button' && /^(Approve|Reject)( Subscriber)?$/.test(content(n)));
}

test('pending subscriber cards route to full verification without browser decision handlers', async () => {
  const p = await page(), tree = p.h.render();
  assert.match(content(tree), /Select the guard there to complete the review/);
  assert.equal(links(tree).filter(n => content(n) === 'Review application').length, 2);
  assert.equal(decisionButtons(tree).length, 0);
  for (const link of links(tree)) assert.equal(link.props.onClick, undefined);
  assert.equal(p.reads.length, 1);
  p.assertUnchanged();
});

test('quick view retains guard details but routes decisions through the same review workflow', async () => {
  const p = await page();
  nodes(p.h.render()).find(n => n.type === 'button' && content(n) === 'Quick View').props.onClick();
  let tree = p.h.render();
  assert.match(content(tree), /Subscriber Details/);
  assert.match(content(tree), /Synthetic pending/);
  assert.equal(links(tree).filter(n => content(n) === 'Review application in Guard Verifications').length, 1);
  assert.equal(decisionButtons(tree).length, 0);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Close subscriber details').props.onClick();
  tree = p.h.render();
  assert.doesNotMatch(content(tree), /Subscriber Details/);
  assert.equal(p.reads.length, 1);
  p.assertUnchanged();
});

test('status filters, refresh and read errors retain a review route without falling back to writes', async () => {
  const p = await page();
  for (const [filter, shown, hidden] of [['Verified', 'Synthetic approved', 'Synthetic pending'],
    ['Rejected', 'Synthetic rejected', 'Synthetic approved'], ['All', 'Synthetic unclassified', null]]) {
    nodes(p.h.render()).find(n => n.type === 'button' && content(n).startsWith(`${filter} (`)).props.onClick();
    const tree = p.h.render();
    assert(content(tree).includes(shown));
    if (hidden) assert(!content(tree).includes(hidden));
    assert.equal(decisionButtons(tree).length, 0);
  }
  nodes(p.h.render()).find(n => n.type === 'button' && content(n).trim() === 'Refresh').props.onClick();
  await p.h.effects();
  assert.equal(p.reads.length, 2);
  p.assertUnchanged();
  const failed = await page({ ok: false }), tree = failed.h.render();
  assert.match(content(tree), /Error loading subscribers/);
  assert.equal(links(tree).length, 1);
  assert.equal(decisionButtons(tree).length, 0);
  failed.assertUnchanged();
});
