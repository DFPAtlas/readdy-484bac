const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { hooksHarness, flush } = require('../tests/helpers/guard-ui-fixture.cjs');

function transpile(path, jsx) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: jsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
    },
  }).outputText;
}

function load(path, mocks = {}) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', transpile(path, false))(mod, mod.exports, name =>
    name in mocks ? mocks[name] : require(name)
  );
  return mod.exports;
}

function loadDefault(path, mocks = {}) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', transpile(path, true))(mod, mod.exports, name =>
    name in mocks ? mocks[name] : require(name)
  );
  return mod.exports.default;
}

const { planLabel } = load('lib/client-journey.ts');

const state = {
  authUser: { id: 'user-a' },
  authSequence: null,
  authError: null,
  entitlement: null,
  readThrows: false,
  readIds: [],
};

const supabaseMock = {
  auth: {
    async getUser() {
      if (state.authSequence) {
        const user = state.authSequence.shift();
        return { data: { user }, error: state.authError };
      }
      return { data: { user: state.authUser }, error: state.authError };
    },
  },
};

const entitlementMock = {
  async getUserEntitlements(userId) {
    state.readIds.push(userId);
    if (state.readThrows) throw new Error('entitlement read failed');
    return state.entitlement;
  },
};

const access = load('lib/client-access-plan.ts', {
  './supabase': { supabase: supabaseMock },
  './entitlements': entitlementMock,
  './client-journey': { planLabel },
});

function resetState(overrides = {}) {
  state.authUser = { id: 'user-a' };
  state.authSequence = null;
  state.authError = null;
  state.entitlement = null;
  state.readThrows = false;
  state.readIds = [];
  Object.assign(state, overrides);
}

function entitlement(overrides = {}) {
  return {
    user_id: 'user-a',
    plan_slug: 'client_enterprise',
    plan_name: 'Client Enterprise',
    audience: 'client',
    is_active: true,
    ...overrides,
  };
}

test('access label is explicit, neutral while loading and never duplicates the prefix', () => {
  assert.equal(access.clientAccessLabel(access.CLIENT_ACCESS_LOADING), 'Access: Loading…');
  assert.equal(access.clientAccessLabel(null), 'Access: Loading…');
  assert.equal(access.clientAccessLabel(access.clientAccessUnavailable()), 'Access: Unavailable');
  assert.equal(access.clientAccessLabel({ status: 'inactive', planName: 'Client Enterprise', planSlug: null }), 'Access: Inactive');
  assert.equal(access.clientAccessLabel({ status: 'ready', planName: 'Client Enterprise', planSlug: 'client_enterprise' }), 'Access: Client Enterprise');
  assert.equal(access.clientAccessLabel({ status: 'ready', planName: 'Access: Client Pro', planSlug: null }), 'Access: Client Pro');
  assert.equal(access.clientAccessLabel({ status: 'ready', planName: null, planSlug: 'client_starter' }), 'Access: Client Starter');
  assert.equal(access.clientAccessLabel({ status: 'ready', planName: null, planSlug: null }), 'Access: Unavailable');
  assert.equal(access.stripAccessPrefix('  Access:   Client Enterprise '), 'Client Enterprise');
});

test('entitlement plan drives the label for every matching audience plan', async () => {
  for (const [name, slug, expected] of [
    ['Client Starter', 'client_starter', 'Access: Client Starter'],
    ['Client Pro', 'client_pro', 'Access: Client Pro'],
    ['Client Enterprise', 'client_enterprise', 'Access: Client Enterprise'],
  ]) {
    resetState({ entitlement: entitlement({ plan_name: name, plan_slug: slug }) });
    const resolved = await access.resolveClientAccessPlan();
    assert.equal(resolved.status, 'ready');
    assert.equal(access.clientAccessLabel(resolved), expected);
  }
  resetState({ entitlement: entitlement({ plan_name: null, plan_slug: 'client_enterprise' }) });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Client Enterprise');
});

test('starter profile with enterprise access shows client enterprise access', async () => {
  resetState({ entitlement: entitlement({ plan_name: 'Client Enterprise', plan_slug: 'client_enterprise' }) });
  const resolved = await access.resolveClientAccessPlan('user-a');
  assert.equal(resolved.status, 'ready');
  assert.equal(access.clientAccessLabel(resolved), 'Access: Client Enterprise');
  assert.deepEqual(state.readIds, ['user-a']);
});

test('missing, failed and inactive access never claim an active enterprise plan', async () => {
  resetState({ entitlement: null });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Unavailable');

  resetState({ readThrows: true });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Unavailable');

  resetState({ authError: { message: 'no session' } });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Unavailable');

  resetState({ entitlement: entitlement({ is_active: false }) });
  const inactive = await access.resolveClientAccessPlan();
  assert.equal(inactive.status, 'inactive');
  assert.equal(access.clientAccessLabel(inactive), 'Access: Inactive');
  assert.doesNotMatch(access.clientAccessLabel(inactive), /Enterprise/);
});

test('entitlements from another user or audience never render as the client plan', async () => {
  resetState({ entitlement: entitlement({ user_id: 'user-b' }) });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Unavailable');

  resetState({ entitlement: entitlement({ audience: 'guard' }) });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan()), 'Access: Unavailable');

  resetState({ entitlement: entitlement() });
  assert.equal(access.clientAccessLabel(await access.resolveClientAccessPlan('user-b')), 'Access: Unavailable');
  assert.deepEqual(state.readIds, []);
});

test('late responses follow the authenticated identity after an account switch', async () => {
  resetState({ entitlement: entitlement({ user_id: 'user-a', plan_name: 'Client Starter', plan_slug: 'client_starter' }) });
  const first = await access.resolveClientAccessPlan('user-a');

  state.authUser = { id: 'user-b' };
  state.entitlement = entitlement({ user_id: 'user-b', plan_name: 'Client Enterprise', plan_slug: 'client_enterprise' });
  const second = await access.resolveClientAccessPlan('user-b');

  assert.equal(access.clientAccessLabel(first), 'Access: Client Starter');
  assert.equal(access.clientAccessLabel(second), 'Access: Client Enterprise');
  assert.deepEqual(state.readIds, ['user-a', 'user-b']);
});

test('unknown or malformed activity state is unavailable and never ready', async () => {
  for (const patch of [
    { is_active: undefined },
    { is_active: null },
    { is_active: 'true' },
    { audience: '' },
    { audience: undefined },
    { audience: 'Client Admin' },
    { plan_name: '   ', plan_slug: '' },
    { plan_name: null, plan_slug: null },
    { plan_name: 5, plan_slug: {} },
  ]) {
    resetState({ entitlement: entitlement(patch) });
    const resolved = await access.resolveClientAccessPlan();
    assert.equal(resolved.status, 'unavailable', JSON.stringify(patch));
    assert.equal(access.clientAccessLabel(resolved), 'Access: Unavailable');
  }
  resetState({ entitlement: entitlement({ is_active: false }) });
  const inactive = await access.resolveClientAccessPlan();
  assert.equal(inactive.status, 'inactive');
  assert.equal(access.clientAccessLabel(inactive), 'Access: Inactive');
});

test('resolver rechecks the authenticated identity after the entitlement read', async () => {
  resetState({
    entitlement: entitlement(),
    authSequence: [{ id: 'user-a' }, { id: 'user-b' }],
  });
  const resolved = await access.resolveClientAccessPlan('user-a');
  assert.equal(resolved.status, 'unavailable');
  assert.equal(access.clientAccessLabel(resolved), 'Access: Unavailable');
  assert.deepEqual(state.readIds, ['user-a']);

  resetState({
    entitlement: entitlement({ is_active: false }),
    authSequence: [{ id: 'user-a' }, null],
  });
  assert.equal((await access.resolveClientAccessPlan()).status, 'unavailable');
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function hookFixture() {
  const authReads = [];
  const entitlementReads = [];
  let callback = null;
  const answer = (userId) => ({ data: { user: userId ? { id: userId } : null }, error: null });

  const db = {
    auth: {
      getUser() {
        const pending = deferred();
        authReads.push(pending);
        return pending.promise;
      },
      onAuthStateChange(fn) {
        callback = fn;
        return { data: { subscription: { unsubscribe() { callback = null; } } } };
      },
    },
  };

  const entitlements = {
    getUserEntitlements(userId) {
      const pending = deferred();
      entitlementReads.push({ userId, ...pending });
      return pending.promise;
    },
  };

  const module = load('lib/client-access-plan.ts', {
    './supabase': { supabase: db },
    './entitlements': entitlements,
    './client-journey': { planLabel },
  });

  const h = hooksHarness('hooks/useClientAccessPlan.ts', {
    '@/lib/client-access-plan': module,
    '@/lib/supabase': { supabase: db },
  });

  const useHook = h.exported.useClientAccessPlan;
  const render = (enabled, userId) =>
    h.renderComponent((args) => useHook(args[0], args[1]), [enabled, userId]);
  const label = (enabled, userId) => module.clientAccessLabel(render(enabled, userId));

  async function settle(userId, value) {
    const initial = authReads[authReads.length - 1];
    initial.resolve(answer(userId));
    await flush();
    entitlementReads[entitlementReads.length - 1].resolve(value ?? null);
    await flush();
    const recheck = authReads[authReads.length - 1];
    if (recheck !== initial) {
      recheck.resolve(answer(userId));
      await flush();
    }
  }

  return {
    h,
    module,
    authReads,
    entitlementReads,
    emit(event, session) { callback(event, session); },
    render,
    label,
    settle,
    async start(enabled = true, userId) {
      render(enabled, userId);
      await h.effects();
    },
  };
}

test('hook returns neutral loading synchronously when the render context changes', async () => {
  const f = hookFixture();
  await f.start(true, 'user-a');
  await f.settle('user-a', entitlement({ user_id: 'user-a' }));
  assert.equal(f.label(true, 'user-a'), 'Access: Client Enterprise');

  const switched = f.render(true, 'user-b');
  assert.equal(switched.status, 'loading');
  assert.equal(switched.planName, null);
  assert.equal(switched.planSlug, null);

  await f.h.effects();
  assert.equal(f.entitlementReads[0].userId, 'user-a');
  await f.settle('user-b', entitlement({ user_id: 'user-b', plan_name: 'Client Starter', plan_slug: 'client_starter' }));
  assert.equal(f.label(true, 'user-b'), 'Access: Client Starter');
  assert.equal(f.h.writes > 0, true);
  f.h.unmount();
});

test('hook cannot reuse a settled label after enabled toggles off and on', async () => {
  const f = hookFixture();
  await f.start(true, 'user-a');
  await f.settle('user-a', entitlement({ user_id: 'user-a' }));
  assert.equal(f.label(true, 'user-a'), 'Access: Client Enterprise');

  const disabled = f.render(false, 'user-a');
  assert.equal(disabled.status, 'loading');
  await f.h.effects();

  const reenabled = f.render(true, 'user-a');
  assert.equal(reenabled.status, 'loading');
  assert.equal(reenabled.planName, null);
  await f.h.effects();

  await f.settle('user-a', entitlement({ user_id: 'user-a', plan_name: 'Client Pro', plan_slug: 'client_pro' }));
  assert.equal(f.label(true, 'user-a'), 'Access: Client Pro');
  f.h.unmount();
});

test('first signed-in event invalidates an in-flight read and its late response', async () => {
  const f = hookFixture();
  await f.start(true, undefined);
  assert.equal(f.authReads.length, 1);

  f.emit('SIGNED_IN', { user: { id: 'user-b' } });
  await flush();
  assert.equal(f.authReads.length, 2);
  assert.equal(f.label(true, undefined), 'Access: Loading…');

  f.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await flush();
  assert.equal(f.entitlementReads[0].userId, 'user-a');

  f.authReads[1].resolve({ data: { user: { id: 'user-b' } }, error: null });
  await flush();
  assert.equal(f.entitlementReads[1].userId, 'user-b');
  f.entitlementReads[1].resolve(entitlement({ user_id: 'user-b' }));
  await flush();
  f.authReads[2].resolve({ data: { user: { id: 'user-b' } }, error: null });
  await flush();
  assert.equal(f.label(true, undefined), 'Access: Client Enterprise');

  f.entitlementReads[0].resolve(entitlement({ user_id: 'user-a', plan_name: 'Client Starter', plan_slug: 'client_starter' }));
  await flush();
  f.authReads[3].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await flush();
  assert.equal(f.label(true, undefined), 'Access: Client Enterprise');
  assert.doesNotMatch(f.label(true, undefined), /Starter/);
  f.h.unmount();
});

test('ignores late responses and state writes after unmount', async () => {
  const f = hookFixture();
  await f.start(true, 'user-a');
  f.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await flush();
  const entitlementRead = f.entitlementReads[0];
  f.h.unmount();
  const writesAfterUnmount = f.h.writes;

  entitlementRead.resolve(entitlement());
  await flush();
  const recheck = f.authReads[1];
  assert.ok(recheck);
  recheck.resolve({ data: { user: { id: 'user-a' } }, error: null });
  await flush();

  assert.equal(f.h.writes, writesAfterUnmount);
  assert.equal(f.module.clientAccessLabel(f.render(true, 'user-a')), 'Access: Loading…');
});

test('hook never renders missing, inactive or foreign-role access as a client plan', async () => {
  for (const [value, expected] of [
    [null, 'Access: Unavailable'],
    [entitlement({ user_id: 'user-a', plan_name: 'Client Enterprise', plan_slug: 'client_enterprise', is_active: false }), 'Access: Inactive'],
    [entitlement({ user_id: 'user-a', is_active: undefined }), 'Access: Unavailable'],
    [entitlement({ user_id: 'user-a', is_active: null }), 'Access: Unavailable'],
    [entitlement({ user_id: 'user-a', audience: 'guard' }), 'Access: Unavailable'],
    [entitlement({ user_id: 'user-b' }), 'Access: Unavailable'],
    [entitlement({ user_id: 'user-a', plan_name: '  ', plan_slug: '' }), 'Access: Unavailable'],
  ]) {
    const f = hookFixture();
    await f.start(true, 'user-a');
    await f.settle('user-a', value);
    assert.equal(f.label(true, 'user-a'), expected, JSON.stringify(value));
    f.h.unmount();
  }

  const f = hookFixture();
  await f.start(false, 'user-a');
  assert.equal(f.label(false, 'user-a'), 'Access: Loading…');
  f.h.unmount();
});

const pathnameMock = { usePathname: () => '/client/jobs' };
let hookAccess = { status: 'ready', planName: 'Client Starter', planSlug: 'client_starter' };

const SidebarLink = {
  __esModule: true,
  default: (props) => {
    const { children, prefetch, ...rest } = props;
    void prefetch;
    return React.createElement('a', rest, children);
  },
};

function renderSidebar(props) {
  const PortalSidebar = loadDefault('components/PortalSidebar.tsx', {
    'next/link': SidebarLink,
    'next/navigation': pathnameMock,
    '@/lib/supabase': { supabase: { auth: { async getUser() { return { data: { user: { id: 'user-a' } } }; }, async signOut() {} } } },
    '@/hooks/useSafeRouter': { useSafeRouter: () => ({ push() {} }) },
    '@/lib/entitlements': { getAllClientFeatures: async () => ({}) },
    '@/lib/SidebarContext': { useSidebar: () => ({ collapsed: false, toggle() {} }) },
    '@/lib/company-navigation': { companyTabHref: tab => `/company/dashboard?tab=${tab}` },
    '@/components/NotificationBadge': { default: () => null },
    '@/components/BrandLogo': { default: () => React.createElement('span', null, 'logo') },
    '@/lib/client-access-plan': { clientAccessLabel: access.clientAccessLabel },
    '@/hooks/useClientAccessPlan': { useClientAccessPlan: () => hookAccess },
  });
  return renderToStaticMarkup(React.createElement(PortalSidebar, props));
}

const baseProps = { displayName: 'Acme Events', initials: 'AE', collapsible: false };

test('client sidebar shows resolved enterprise access despite a legacy starter subtitle', () => {
  hookAccess = { status: 'ready', planName: 'Client Enterprise', planSlug: 'client_enterprise' };
  const html = renderSidebar({ ...baseProps, role: 'client', subtitle: 'Client Starter' });
  assert.match(html, /Access: Client Enterprise/);
  assert.doesNotMatch(html, /Access: Access:/);
  assert.doesNotMatch(html, /Client Starter/);
});

test('client sidebar shows neutral loading and unavailable states instead of legacy tiers', () => {
  hookAccess = access.CLIENT_ACCESS_LOADING;
  let html = renderSidebar({ ...baseProps, role: 'client', subtitle: 'Client Enterprise' });
  assert.match(html, /Access: Loading/);
  assert.doesNotMatch(html, /Enterprise|Starter|Free/);

  hookAccess = access.clientAccessUnavailable();
  html = renderSidebar({ ...baseProps, role: 'client', subtitle: 'Client Enterprise' });
  assert.match(html, /Access: Unavailable/);
  assert.doesNotMatch(html, /Enterprise/);

  hookAccess = { status: 'inactive', planName: 'Client Enterprise', planSlug: 'client_enterprise' };
  html = renderSidebar({ ...baseProps, role: 'client', subtitle: 'Client Enterprise' });
  assert.match(html, /Access: Inactive/);
  assert.doesNotMatch(html, /Access: Client Enterprise/);
});

test('guard and company sidebar subtitles stay unchanged', () => {
  hookAccess = { status: 'ready', planName: 'Client Enterprise', planSlug: 'client_enterprise' };
  const guardHtml = renderSidebar({ ...baseProps, role: 'guard', subtitle: 'SIA Licensed Guard' });
  assert.match(guardHtml, /SIA Licensed Guard/);
  assert.doesNotMatch(guardHtml, /Access:/);

  const companyHtml = renderSidebar({ ...baseProps, role: 'company', subtitle: 'Company Admin', companyTab: 'sites' });
  assert.match(companyHtml, /Company Admin/);
  assert.doesNotMatch(companyHtml, /Access:/);
});