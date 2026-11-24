const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hooksHarness, nodes } = require('./helpers/guard-ui-fixture.cjs');

const childNames = ['RequestInfoModal', 'Toast', 'GuardTable', 'GuardMobileCard', 'GuardHeaderCard',
  'ReviewTabs', 'OverviewTab', 'LicenceReviewPanel', 'ProfessionalTab', 'AvailabilityTab',
  'VerificationFooter', 'RejectModal', 'ApproveConfirmModal', 'OverrideApproveModal',
  'VerificationSkeleton', 'DocumentsReviewPanel', 'AccountTab'];

async function review() {
  const body = { style: { overflow: 'clip' } }, requests = [], scrolls = [], focusCalls = [];
  const guard = { id: 'synthetic-review', full_name: 'Synthetic Guard', email: 'qa@example.test',
    profile_completed: false, verification_status: 'pending', sia_licence_number: '',
    sia_check_status: null, created_at: '2026-11-24T00:00:00Z' };
  const h = hooksHarness('app/admin/guard-verifications/GuardVerificationsClient.tsx', {
    ...Object.fromEntries(childNames.map(name => ['./' + name, { __esModule: true, default: () => null }])),
    'next/link': { __esModule: true, default: () => null },
    'focus-trap-react': { __esModule: true, default: () => null },
    '@/hooks/useAdminAuth': { useAdminAuth: () => ({ username: 'QA', role: 'super_admin' }) },
    '@/lib/supabase': { supabase: { auth: { async getSession() {
      return { data: { session: { access_token: 'fixture' } }, error: null };
    } } } },
  }, { document: { body }, setTimeout: fn => { fn(); return 0; },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } },
    fetch: async url => { requests.push(url); assert.match(url, /\/get-guards$/);
      return { ok: true, json: async () => ({ data: [guard] }) }; } });
  h.render(); await h.effects();
  const table = nodes(h.render()).find(n => n.props?.onReview && n.props?.guards);
  table.props.onReview(guard);
  const tree = h.render();
  const region = nodes(tree).find(n => n.props?.['aria-label'] === 'Guard application details');
  assert(region, 'Review details need a focusable scroll region');
  const scrollArea = { scrollTo: value => scrolls.push(value), focus: value => focusCalls.push(value) };
  region.props.ref.current = scrollArea;
  await h.effects();
  return { h, body, requests, scrolls, focusCalls, scrollArea, guard,
    trap: () => nodes(h.render()).find(n => n.props?.focusTrapOptions),
    close: () => nodes(h.render()).find(n => n.props?.['aria-label'] === 'Close guard details').props.onClick(),
    footer: () => nodes(h.render()).find(n => typeof n.props?.onReject === 'function' && typeof n.props?.onOverride === 'function'),
    escape: () => { let stopped = false;
      nodes(h.render()).find(n => typeof n.props?.onKeyDown === 'function').props.onKeyDown({ key: 'Escape', stopPropagation() { stopped = true; } });
      return stopped;
    },
  };
}

test('opening review targets the details region and restores background scrolling when closed', async () => {
  const page = await review();
  assert.equal(page.body.style.overflow, 'hidden');
  assert.equal(page.trap().props.focusTrapOptions.initialFocus(), page.scrollArea);
  assert.equal(page.trap().props.focusTrapOptions.fallbackFocus(), page.scrollArea);
  assert.deepEqual(page.scrolls, [{ top: 0 }]);
  assert.deepEqual(page.focusCalls, [{ preventScroll: true }]);
  page.close(); page.h.render(); await page.h.effects();
  assert.equal(page.body.style.overflow, 'clip');
  assert.equal(page.trap(), undefined);
  assert(page.requests.every(url => url.endsWith('/get-guards')));
});

test('changing detail tabs returns to the beginning; closing with Escape makes no guard decision', async () => {
  const page = await review();
  const tabs = nodes(page.h.render()).find(n => typeof n.props?.onTabChange === 'function');
  tabs.props.onTabChange('professional'); page.h.render(); await page.h.effects();
  assert.deepEqual(page.scrolls, [{ top: 0 }, { top: 0 }]);
  assert.deepEqual(page.focusCalls, [{ preventScroll: true }, { preventScroll: true }]);
  assert.equal(page.escape(), true);
  page.h.render(); await page.h.effects();
  assert.equal(page.trap(), undefined);
  assert.equal(page.body.style.overflow, 'clip');
  assert(page.requests.every(url => url.endsWith('/get-guards')));
});

test('reject and override confirmations suspend the review trap and Escape cannot close the underlying review', async () => {
  for (const action of ['onReject', 'onOverride']) {
    const page = await review();
    assert.equal(page.trap().props.paused, false);
    page.footer().props[action]();
    assert.equal(page.trap().props.paused, true);
    assert.equal(page.escape(), false);
    const modal = nodes(page.h.render()).find(n => n.props?.open === true && typeof n.props?.onConfirm === 'function');
    assert(modal);
    modal.props.onCancel();
    assert.equal(page.trap().props.paused, false);
    assert.equal(page.body.style.overflow, 'hidden');
    page.h.unmount();
    assert.equal(page.body.style.overflow, 'clip');
    assert(page.requests.every(url => url.endsWith('/get-guards')));
  }
});

test('request-info remains usable above the review and closing it resumes review focus', async () => {
  const page = await review();
  const table = nodes(page.h.render()).find(n => n.props?.onRequestInfo && n.props?.guards);
  table.props.onRequestInfo(page.guard);
  assert.equal(page.trap().props.paused, true);
  const modal = nodes(page.h.render()).find(n => typeof n.props?.onSent === 'function');
  modal.props.onClose();
  assert.equal(page.trap().props.paused, false);
  page.h.unmount();
  assert.equal(page.body.style.overflow, 'clip');
  assert(page.requests.every(url => url.endsWith('/get-guards')));
});
