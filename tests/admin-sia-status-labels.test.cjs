const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');
const { getSiaCheckStatusBadge: badge, getSiaCheckStatusText: text } = load('app/admin/guard-verifications/types.ts');

test('completed stored outcomes do not masquerade as pending checks', () => {
  for (const status of ['verified', 'valid', 'expired', 'not_found', 'invalid_licence_format', 'queue_error']) {
    const result = badge(status, 'approved');
    assert.doesNotMatch(result.label, /Pending/);
    assert.notEqual(result.icon, 'ri-loader-4-line');
    assert.doesNotMatch(text(status, 'approved'), /unknown|pending|in progress/i);
  }
  assert.match(badge('not_found', 'approved').label, /Not found/);
  assert.match(badge('expired', 'approved').color, /red/);
});

test('missing and unknown evidence never imply a running check or a missing webhook', () => {
  for (const profileStatus of ['approved', 'verified', 'manual_review', 'pending']) {
    assert.match(badge(null, profileStatus).label, /Not recorded/);
    assert.doesNotMatch(text(null, profileStatus), /webhook|pending|in progress/i);
  }
  for (const status of ['future_status', 'constructor', '__proto__']) {
    assert.match(badge(status, 'approved').label, /Unknown/);
    assert.doesNotMatch(badge(status, 'approved').color, /emerald/);
  }
  assert.match(badge('pending', 'manual_review').label, /Pending/);
  assert.doesNotMatch(badge('pending', 'manual_review').label, /Webhook/);
  assert.match(badge('webhook_missing', 'pending').label, /Webhook Missing/);
});

test('explicit test results and labelled test accounts remain distinct from production verification', () => {
  for (const [status, context] of [['verified_test', {}], ['verified', { is_test_account: true }]]) {
    const result = badge(status, 'approved', context);
    assert.match(result.label, /test/i);
    assert.doesNotMatch(result.color, /emerald/);
    assert.match(text(status, 'approved', context), /test/i);
  }
  assert.doesNotMatch(badge('verified', 'approved', { is_test_account: false }).label, /test/i);
});

test('manual override and mismatch provenance cannot be represented as an automated pass', () => {
  const override = { sia_mismatch_reason: 'Manual override by admin' };
  assert.match(badge('passed', 'approved', override).label, /Manual override/);
  assert.doesNotMatch(badge('passed', 'approved', override).color, /emerald/);
  assert.match(text('not_found', 'approved', override), /not found/i);
  const mismatch = { sia_mismatch_reason: 'licence_not_found' };
  assert.match(badge('verified', 'approved', mismatch).label, /review/i);
  assert.doesNotMatch(badge('verified', 'approved', mismatch).color, /emerald/);
  assert.match(text('verified', 'approved', mismatch), /licence_not_found/);
});

function guard(status, context = {}) {
  return { id: 'guard', full_name: 'Synthetic Guard', email: 'synthetic@example.test',
    sia_check_status: status, verification_status: 'approved', sia_licence_number: '',
    created_at: '2026-11-23T00:00:00Z', sia_expiry_date: null, sia_checked_at: null,
    sia_confidence_score: null, sia_mismatch_reason: null, profile_completed: false, ...context };
}
async function modal(profile) {
  const stubs = Object.fromEntries(['RequestInfoModal','Toast','GuardTable','GuardMobileCard','GuardHeaderCard','ReviewTabs','OverviewTab','LicenceReviewPanel','ProfessionalTab','AvailabilityTab','VerificationFooter','RejectModal','ApproveConfirmModal','OverrideApproveModal','VerificationSkeleton','DocumentsReviewPanel','AccountTab'].map(name => ['./'+name, { __esModule: true, default: () => null }]));
  const h = hooksHarness('app/admin/guard-verifications/GuardVerificationsClient.tsx', {
    ...stubs, 'next/link': { __esModule: true, default: () => null },
    '@/hooks/useAdminAuth': { useAdminAuth: () => ({ username: 'QA' }) },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) } } },
  }, { fetch: async url => { assert.match(url, /\/get-guards$/); return { ok: true, json: async () => [profile] }; },
    setTimeout: fn => { fn(); return 0; }, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } } });
  h.render(); await h.effects();
  nodes(h.render()).find(n => n.props?.onReview && Array.isArray(n.props.guards)).props.onReview(profile);
  return h.render();
}

test('the active review modal, profile header and SIA section all use the same contextual status', async () => {
  const imageStub = { __esModule: true, default: () => null };
  const Header = load('app/admin/guard-verifications/GuardHeaderCard.tsx', { '@/components/QuickGuardImage': imageStub }).default;
  const Section = load('app/admin/guard-verifications/SIALicenseSection.tsx', { './SiaRegisterCheckPanel': imageStub }).default;
  for (const profile of [guard('verified'), guard(null), guard('passed', { sia_mismatch_reason: 'Manual override by admin' }), guard('verified', { is_test_account: true })]) {
    const expected = badge(profile.sia_check_status, profile.verification_status, profile).label;
    assert(content(await modal(profile)).includes(expected));
    assert(content(Header({ guard: profile, hasLicenceImages: false })).includes(expected));
    assert(content(Section({ guard: profile, hasLicenceImages: false, onViewLicence() {} })).includes(expected));
  }
});
