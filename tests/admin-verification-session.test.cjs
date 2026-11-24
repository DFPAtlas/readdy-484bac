const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');

const childNames = ['RequestInfoModal', 'Toast', 'GuardCardGrid', 'GuardHeaderCard',
  'ReviewTabs', 'OverviewTab', 'LicenceReviewPanel', 'ProfessionalTab', 'AvailabilityTab',
  'VerificationFooter', 'RejectModal', 'ApproveConfirmModal', 'OverrideApproveModal',
  'VerificationSkeleton', 'DocumentsReviewPanel', 'AccountTab'];
function guardsPage(response, session = { access_token: 'fixture' }) {
  const stubs = Object.fromEntries(childNames.map(name => ['./' + name, { __esModule: true, default: () => null }]));
  let result = response, calls = 0;
  const h = hooksHarness('app/admin/guard-verifications/GuardVerificationsClient.tsx', {
    ...stubs, 'next/link': { __esModule: true, default: () => null },
    '@/hooks/useAdminAuth': { useAdminAuth: () => ({ username: 'QA' }) },
    '@/lib/supabase': { supabase: { auth: { async getSession() { return { data: { session }, error: null }; } } } },
  }, { fetch: async () => { calls++; return typeof result === 'function' ? result() : result; },
    setTimeout: () => 0, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } } });
  return { h, setResult(value) { result = value; }, get calls() { return calls; } };
}
const response = (status, data = []) => ({ ok: status === 200, status, json: async () => ({ data }),
  text: async () => 'private provider diagnostics' });

test('guard-list authorization failures stay visible and never claim an empty queue', async () => {
  for (const status of [401, 403]) {
    const { h } = guardsPage(response(status));
    h.render(); await h.effects();
    const tree = h.render(), text = content(tree);
    assert.match(text, /Sign in again/);
    assert.match(text, /Guard list unavailable/);
    assert.doesNotMatch(text, /No guards found|0 results|private provider/);
    assert(nodes(tree).some(n => n.props?.role === 'alert'));
    assert(nodes(tree).some(n => n.props?.href === '/admin/login'));
    for (const node of nodes(tree).filter(n => n.type === 'button' && /Pending|Approved|Rejected|Suspended|Incomplete|All/.test(content(n)))) {
      assert.match(content(node), /—/);
    }
  }
});

test('missing admin credentials fail safely before a guard-list request', async () => {
  const page = guardsPage(response(200), null), h = page.h;
  h.render(); await h.effects();
  assert.match(content(h.render()), /admin session has expired/);
  assert.doesNotMatch(content(h.render()), /No guards found/);
  assert.equal(page.calls, 0);
});

test('a malformed successful response cannot manufacture an empty guard queue', async () => {
  const { h } = guardsPage({ ok: true, status: 200, json: async () => ({ error: 'private provider diagnostics' }) });
  h.render(); await h.effects();
  assert.match(content(h.render()), /Guard list unavailable/);
  assert.doesNotMatch(content(h.render()), /No guards found|0 results|private provider/);
});

test('server and network failures provide a retry that recovers the actual list', async () => {
  for (const failure of [response(503), () => { throw new Error('private provider diagnostics'); }]) {
    const page = guardsPage(failure), h = page.h;
    h.render(); await h.effects();
    assert.match(content(h.render()), /Guard list unavailable/);
    assert.doesNotMatch(content(h.render()), /No guards found|private provider/);
    const retry = nodes(h.render()).find(n => n.type === 'button' && /Retry loading guards/.test(content(n)));
    assert(retry);
    page.setResult(response(200, [{ id: 'fixture-guard', full_name: 'Synthetic Guard', profile_completed: true }]));
    retry.props.onClick(); await h.effects();
    const tree = h.render();
    assert.doesNotMatch(content(tree), /Guard list unavailable|No guards found/);
    assert.match(content(tree), /1 result/);
    assert(nodes(tree).some(n => n.props?.guards?.[0]?.id === 'fixture-guard'));
  }
});

test('a successful empty response still shows the genuine empty state and zero counts', async () => {
  const { h } = guardsPage(response(200)); h.render(); await h.effects();
  assert.match(content(h.render()), /No guards found/);
  assert.match(content(h.render()), /0 results/);
  assert.doesNotMatch(content(h.render()), /Guard list unavailable/);
});

function layout({ user = { id: 'verified-owner' }, error = null, active = true, role = 'super_admin', mfa = 'authorized' } = {}) {
  const pushes = [], signOuts = [], queries = [], router = { push: path => pushes.push(path) };
  let cleared = 0, mfaCalls = 0;
  const db = { auth: {
    async getUser() { return { data: { user }, error }; },
    getSession() { throw new Error('Cached sessions must not authorize the layout'); },
    async signOut(options) { signOuts.push(options); },
  }, from(table) { queries.push(table); const q = {
    select() { return q; }, eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, user.id); return q; },
    async maybeSingle() { return { data: { id: 'admin', email: 'qa@example.test', is_active: active, role } }; },
  }; return q; } };
  const h = hooksHarness('app/admin/layout.tsx', {
    'next/navigation': { usePathname: () => '/admin/guard-verifications' },
    '@/hooks/useSafeRouter': { useSafeRouter: () => router },
    '@/lib/admin-application-link': { rememberApplicationLink() {} },
    '@/lib/admin-mfa': { async resolveAdminMfaRoute() { mfaCalls++; return mfa; } },
    '@/hooks/useAdminAuth': { clearAdminAuthCache() { cleared++; } },
    '@/lib/supabase': { supabase: db },
    ...Object.fromEntries(['AdminSidebar', 'AdminSessionTimeout', 'AdminSessionHeartbeat'].map(name => ['@/components/' + name, { __esModule: true, default: () => null }])),
  });
  return { h, pushes, signOuts, queries, get cleared() { return cleared; }, get mfaCalls() { return mfaCalls; } };
}

test('revoked or missing server sessions cannot mount protected admin screens', async () => {
  for (const auth of [{ user: null }, { user: { id: 'cached-owner' }, error: { code: 'session_not_found' } }]) {
    const page = layout(auth); page.h.render({ children: 'PRIVATE ADMIN SCREEN' }); await page.h.effects();
    assert.equal(page.h.render({ children: 'PRIVATE ADMIN SCREEN' }), null);
    assert.deepEqual(page.pushes, ['/admin/login']);
    assert.deepEqual(page.signOuts, [{ scope: 'local' }]);
    assert.equal(page.cleared, 1);
    assert.deepEqual(page.queries, []);
    assert.equal(page.mfaCalls, 0);
  }
});

test('verified active admins still require their existing role and MFA gates', async () => {
  for (const role of ['super_admin', 'admin', 'finance_admin']) {
    const page = layout({ role }); page.h.render({ children: 'PRIVATE ADMIN SCREEN' }); await page.h.effects();
    assert.match(content(page.h.render({ children: 'PRIVATE ADMIN SCREEN' })), /PRIVATE ADMIN SCREEN/);
    assert.deepEqual(page.pushes, []);
    assert.equal(page.mfaCalls, 1);
  }
  for (const [settings, target] of [[{ mfa: 'mfa' }, '/admin/mfa'], [{ mfa: 'setup' }, '/admin/mfa/setup'],
    [{ active: false }, '/admin/login'], [{ role: 'guard' }, '/admin/login']]) {
    const page = layout(settings); page.h.render({ children: 'PRIVATE ADMIN SCREEN' }); await page.h.effects();
    assert.equal(page.h.render({ children: 'PRIVATE ADMIN SCREEN' }), null);
    assert.deepEqual(page.pushes, [target]);
  }
});
