const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content, flush } = require('./helpers/guard-ui-fixture.cjs');
const { guardPage } = require('./helpers/admin-guard-pages.cjs');

const records = (count = 225) => Array.from({ length: count }, (_, i) => ({
  id: `guard-${i}`, full_name: `Synthetic Guard ${i}`, email: `qa-${i}@example.invalid`,
  verification_status: 'pending', profile_completed: false, created_at: '2026-11-24T00:00:00Z',
  licence_types: [], phone: '', sia_licence_number: '', sia_check_status: null,
}));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = (data, options) => ({ ok: true, status: 200, json: async () => guardPage(data, options) });
const request = { status: 'pending', token: 'local-session' };
const environment = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid' } }, setTimeout: () => 0 };
function loader(fetch, extra = {}) { return load('lib/admin-guard-list.ts', {}, { ...environment, fetch, ...extra }); }

test('guard loader retrieves 225 distinct guards over three bounded pages without writes', async () => {
  const guards = records(), calls = [];
  const api = loader(async (url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    assert.equal(url, 'https://fixture.invalid/functions/v1/get-guards');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer local-session');
    assert.equal(body.pageSize, 100);
    assert.equal(body.status, 'pending');
    return response(guards, options);
  });
  assert.deepEqual(await api.loadAdminGuardList(request), guards);
  assert.deepEqual(calls.map(c => c.page), [1, 2, 3]);
});

test('count requests use totalCount with one record rather than reporting the page length', async () => {
  let body;
  const api = loader(async (_url, options) => { body = JSON.parse(options.body); return response(records(), options); });
  assert.equal(await api.loadAdminGuardCount({ ...request, status: 'all', incompleteOnly: true }), 225);
  assert.deepEqual(body, { status: 'all', incompleteOnly: true, page: 1, pageSize: 1 });
});

test('a failed later page never returns a successful partial list; retry recovers every guard', async () => {
  let fail = true;
  const api = loader(async (_url, options) => JSON.parse(options.body).page === 2 && fail
    ? { ok: false, status: 503, json: async () => ({ error: 'private provider detail' }) } : response(records(), options));
  await assert.rejects(api.loadAdminGuardList(request), error => !error.message.includes('private') && /retry/i.test(error.message));
  fail = false;
  assert.equal((await api.loadAdminGuardList(request)).length, 225);
});

test('malformed, truncated, duplicate, changed-total and wrong-page responses fail visibly', async () => {
  const mutations = [
    data => ({ data: data.data }),
    data => ({ ...data, data: data.data.slice(0, 50), count: 50 }),
    data => ({ ...data, page: data.page + 1 }),
    data => ({ ...data, pageSize: 50 }),
    data => ({ ...data, count: 0 }),
    data => ({ ...data, totalCount: -1 }),
    data => ({ ...data, data: data.data.map((guard, i) => i === 0 ? { ...guard, id: '' } : guard) }),
    data => data.page === 2 ? { ...data, totalCount: 226 } : data,
    data => data.page === 2 ? { ...data, data: data.data.map((guard, i) => i === 0 ? { ...guard, id: 'guard-0' } : guard) } : data,
  ];
  for (const mutate of mutations) {
    const api = loader(async (_url, options) => ({ ok: true, json: async () => mutate(guardPage(records(), options)) }));
    await assert.rejects(api.loadAdminGuardList(request), /retry/i);
  }
});

test('empty lists complete in one request, and missing or rejected sessions never become empty success', async () => {
  let calls = 0;
  const api = loader(async (_url, options) => { calls++; return response([], options); });
  assert.deepEqual(await api.loadAdminGuardList(request), []);
  assert.equal(calls, 1);
  await assert.rejects(api.loadAdminGuardList({ ...request, token: '' }), error => error.signIn === true);
  assert.equal(calls, 1);
  for (const status of [401, 403]) {
    const denied = loader(async () => ({ ok: false, status }));
    await assert.rejects(denied.loadAdminGuardList(request), error => error.signIn === true);
  }
});

test('aborted reads stop pagination even when a transport resolves late', async () => {
  const pending = deferred(), controller = new AbortController(), calls = [];
  const api = loader(async (_url, options) => {
    calls.push(JSON.parse(options.body).page);
    return calls.length === 1 ? response(records(), options) : pending.promise;
  });
  const operation = api.loadAdminGuardList({ ...request, signal: controller.signal });
  await flush();
  controller.abort();
  pending.resolve(response(records(), { page: 2, pageSize: 100 }));
  await assert.rejects(operation, error => error.name === 'AbortError');
  assert.deepEqual(calls, [1, 2]);
});

test('request timeout aborts the transport and reports a retryable failure', async () => {
  let timeout, cleared = false;
  const api = loader((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('private timeout detail')), { once: true });
  }), { setTimeout(fn, delay) { assert.equal(delay, 20000); timeout = fn; return 42; }, clearTimeout(id) { assert.equal(id, 42); cleared = true; } });
  const operation = api.loadAdminGuardList(request);
  timeout();
  await assert.rejects(operation, /Unable to load guard applications/);
  assert.equal(cleared, true);
});

const primaryChildren = ['RequestInfoModal', 'Toast', 'GuardCardGrid', 'GuardHeaderCard', 'ReviewTabs', 'OverviewTab',
  'LicenceReviewPanel', 'ProfessionalTab', 'AvailabilityTab', 'VerificationFooter', 'RejectModal', 'ApproveConfirmModal',
  'OverrideApproveModal', 'VerificationSkeleton', 'DocumentsReviewPanel', 'AccountTab'];
function page(file, guards = records(), intercept) {
  const calls = [];
  const h = hooksHarness(file, {
    ...Object.fromEntries(primaryChildren.map(name => ['./' + name, { __esModule: true, default: () => null }])),
    'next/link': { __esModule: true, default: () => null },
    'focus-trap-react': { __esModule: true, default: () => null },
    '@/components/SIALicenceImage': { __esModule: true, default: () => null },
    '@/hooks/useAdminAuth': { useAdminAuth: () => ({ username: 'QA' }) },
    '@/lib/admin-logger': { logAdminAction() { throw new Error('Read tests must not submit decisions'); } },
    '@/lib/supabase': { supabase: { auth: { async getSession() { return { data: { session: { access_token: 'local-session' } } }; } },
      from() { throw new Error('Paging must not access database mutations'); }, functions: { invoke() { throw new Error('Paging must not submit decisions'); } } } },
  }, { ...environment, fetch: async (url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const special = intercept?.(body, options);
    if (special) return special;
    const filtered = guards.filter(g => (body.status === 'all' ||
      (body.status === 'pending' ? ['pending', 'manual_review', 'pending_sia_check'].includes(g.verification_status) :
        body.status === 'approved' ? ['approved', 'verified'].includes(g.verification_status) : g.verification_status === body.status)) &&
      (!body.incompleteOnly || g.profile_completed === false));
    return response(filtered, options);
  } });
  return { h, calls };
}
const pager = h => nodes(h.render()).find(n => n.props?.onPageChange && typeof n.props.totalItems === 'number');
const cardGrid = h => nodes(h.render()).find(n => n.props?.onReview && Array.isArray(n.props.guards));
const button = (h, text) => nodes(h.render()).find(n => n.type === 'button' && content(n).trim() === text);

test('card queue reaches the last guard, searches all pages, and shows totals above the page size', async () => {
  const { h } = page('app/admin/guard-verifications/GuardVerificationsClient.tsx');
  h.render(); await h.effects();
  assert.equal(cardGrid(h).props.guards.length, 25);
  assert.equal(pager(h).props.totalItems, 225);
  assert.match(content(h.render()), /Pending225/);
  pager(h).props.onPageChange(9);
  assert.equal(cardGrid(h).props.guards.at(-1).id, 'guard-224');
  cardGrid(h).props.onReview(cardGrid(h).props.guards.at(-1));
  assert(nodes(h.render()).some(n => n.props?.guard?.id === 'guard-224'));
  const search = nodes(h.render()).find(n => n.props?.placeholder === 'Search name, email, SIA, phone...');
  search.props.onChange({ target: { value: 'qa-220@' } });
  assert.deepEqual(cardGrid(h).props.guards.map(g => g.id), ['guard-220']);
  assert.equal(pager(h).props.page, 1);
});

test('filter changes and unmount discard delayed list and count results', async () => {
  const lateList = deferred(), lateCount = deferred();
  const guards = [...records(), { ...records(1)[0], id: 'approved', verification_status: 'approved' }];
  const { h } = page('app/admin/guard-verifications/GuardVerificationsClient.tsx', guards, body => {
    if (body.status === 'pending' && body.pageSize === 100 && body.page === 2) return lateList.promise;
    if (body.status === 'pending' && body.pageSize === 1) return lateCount.promise;
  });
  h.render(); await h.effects();
  button(h, 'Approved—').props.onClick(); h.render(); await h.effects();
  assert.deepEqual(cardGrid(h).props.guards.map(g => g.id), ['approved']);
  h.unmount(); const writes = h.writes;
  lateList.resolve(response(records(), { page: 2, pageSize: 100 }));
  lateCount.resolve(response(records(), { page: 1, pageSize: 1 }));
  await flush();
  assert.equal(h.writes, writes);
});

test('later-page card failures hide partial data and retry recovers the complete queue', async () => {
  let fail = true;
  const { h } = page('app/admin/guard-verifications/GuardVerificationsClient.tsx', records(), body =>
    body.page === 2 && fail ? { ok: false, status: 500 } : null);
  h.render(); await h.effects();
  assert.match(content(h.render()), /Guard list unavailable/);
  assert.equal(cardGrid(h), undefined);
  assert.equal(pager(h), undefined);
  fail = false; button(h, 'Retry loading guards').props.onClick(); await h.effects();
  assert.equal(pager(h).props.totalItems, 225);
});

test('subscribers filter across all fetched pages and retain Quick View for the final guard', async () => {
  const guards = records().map((g, i) => ({ ...g, verification_status: i >= 195 ? 'approved' : 'pending' }));
  const { h } = page('app/admin/subscribers/page.tsx', guards);
  h.render(); await h.effects();
  assert.equal(pager(h).props.totalItems, 195);
  button(h, 'Verified (30)').props.onClick();
  assert.equal(pager(h).props.totalItems, 30);
  pager(h).props.onPageChange(2);
  assert.match(content(h.render()), /Synthetic Guard 224/);
  const quickViews = nodes(h.render()).filter(n => n.type === 'button' && content(n) === 'Quick View');
  assert.equal(quickViews.length, 5); quickViews.at(-1).props.onClick();
  assert.match(content(h.render()), /Subscriber Details/);
  assert(nodes(h.render()).some(n => n.props?.href === '/admin/guard-verifications'));
});

test('legacy bulk selection covers only the visible page and clears when the page changes', async () => {
  const { h } = page('app/admin/verify-guards/VerifyGuardsClient.tsx');
  h.render(); await h.effects();
  assert.equal(pager(h).props.totalItems, 225);
  button(h, 'Select this page').props.onClick();
  assert.match(content(h.render()), /25 selected/);
  pager(h).props.onPageChange(9);
  assert.match(content(h.render()), /0 selected/);
  assert.match(content(h.render()), /Synthetic Guard 224/);
  button(h, 'Select this page').props.onClick();
  assert.match(content(h.render()), /25 selected/);
});

test('legacy and subscriber later-page failures show retry without zero totals or empty success', async () => {
  for (const file of ['app/admin/verify-guards/VerifyGuardsClient.tsx', 'app/admin/subscribers/page.tsx']) {
    const { h } = page(file, records(), body => body.page === 2 ? { ok: false, status: 503 } : null);
    h.render(); await h.effects();
    assert.match(content(h.render()), /unavailable|Error loading subscribers/);
    assert.doesNotMatch(content(h.render()), /No Guards Found|No subscribers found|Pending \(0\)/);
    assert.equal(pager(h), undefined);
  }
});

test('pager exposes readable ranges and disables boundary controls on narrow-friendly markup', () => {
  const Pagination = load('components/admin/GuardListPagination.tsx').default;
  const tree = Pagination({ page: 9, totalItems: 225, onPageChange() {} });
  assert.match(content(tree), /Showing 201–225 of 225 guards · Page 9 of 9/);
  assert(nodes(tree).find(n => content(n) === 'Next page').props.disabled);
  assert.equal(nodes(tree).find(n => n.props?.['aria-label'] === 'Guard list pages').type, 'nav');
  assert.match(tree.props.className, /flex-wrap/);
});
