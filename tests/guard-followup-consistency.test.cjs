const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content, childMocks, uiDatabase, flush } = require('./helpers/guard-ui-fixture.cjs');

const usage = (overrides = {}) => ({ allowed: true, reason: 'ok', limit: 40, used: 4, remaining: 36,
  plan_slug: 'guard-elite', plan_name: 'Guard Elite', period_start: '2026-11-01T00:00:00Z',
  period_end: '2026-12-01T00:00:00Z', ...overrides });

function mobileFixture({ status = 'active', planFailure = false, readResult = 'success' } = {}) {
  const db = uiDatabase(), writes = [], alerts = [];
  Object.assign(db.rows.guards[0], { full_name: 'QA Guard', email: 'present', location: 'London', postcode: 'TEST',
    years_experience: null, profile_image_url: null, sia_licence_front_url: null,
    subscription_status: 'active', subscription_plan: 'Incorrect Legacy Plan' });
  db.rows.user_entitlements_data = [{ user_id: 'owner', audience: 'guard', plan_name: 'Guard Elite', subscription_status: status }];
  if (planFailure) db.failure = 'user_entitlements_data';
  db.rows.client_responses = [{ id: 'response', guard_id: 'guard', response_type: 'message',
    message: 'QA client response', is_read: false, created_at: '2026-11-21', jobs: null, clients: null }];
  const from = db.from.bind(db);
  db.from = table => {
    const query = from(table);
    if (table !== 'client_responses') return query;
    query.update = payload => { writes.push({ payload, call: db.calls.at(-1) });
      query.then = (resolve, reject) => {
        if (readResult === 'throw') return Promise.reject(new Error('private transport detail')).then(resolve, reject);
        if (readResult === 'changed') db.owner = 'other';
        return Promise.resolve({ error: readResult === 'error' ? { message: 'private detail' } : null,
          data: readResult === 'zero' ? null : { id: 'response', is_read: readResult !== 'unconfirmed' } }).then(resolve, reject);
      }; return query;
    }; return query;
  };
  const h = hooksHarness('app/guard/mobile/MobileGuardDashboard.tsx', { ...childMocks,
    '@/lib/supabase': { supabase: db }, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/hooks/useGuardPayoutSettings': { useGuardPayoutSettings: () => ({ status: null }) },
    '@/hooks/usePushNotifications': { usePushNotifications: () => ({ subscribed: false }) },
    '@/app/guard/messages/GuardMessagesClient': { __esModule: true, default: () => null },
  }, { alert: message => alerts.push(message), setTimeout: (fn, ms) => ms === 150 ? fn() : setTimeout(fn, ms) });
  return { db, h, writes, alerts, tab(name) { nodes(h.render()).find(node => node.props.tabs).props.onTabChange(name); } };
}

test('desktop and mobile show the same 60% profile progress for the same saved fields', async () => {
  const f = mobileFixture(); f.h.render(); await f.h.effects();
  const Hero = load('app/guard/dashboard/ProfileHeroCard.tsx', childMocks).default;
  assert.match(content(Hero({ guard: f.db.rows.guards[0] })), /60%/);
  assert.match(content(f.h.render()), /60%/);
  f.h.unmount();
});

test('profile completion counts zero years but does not count missing, invalid or whitespace fields', () => {
  const { guardProfileCompletion } = load('lib/guard-profile-completion.ts');
  assert.equal(guardProfileCompletion(null), 0);
  assert.equal(guardProfileCompletion({ full_name: ' ', years_experience: undefined }), 0);
  assert.equal(guardProfileCompletion({ years_experience: 0 }), 15);
  assert.equal(guardProfileCompletion({ years_experience: NaN }), 0);
  assert.equal(guardProfileCompletion({ years_experience: -1 }), 0);
});

test('mobile plan comes from current entitlement, retaining paid trial and both cancelled spellings', async () => {
  for (const [status, text] of [['active', 'Guard Elite'], ['trialing', 'Guard Elite · Trial'],
    ['past_due', 'Guard Elite · Past Due'], ['canceled', 'Guard Elite · Cancelled'], ['cancelled', 'Guard Elite · Cancelled']]) {
    const f = mobileFixture({ status }); f.h.render(); await f.h.effects();
    assert.ok(content(f.h.render()).includes(text));
    assert.doesNotMatch(content(f.h.render()), /Incorrect Legacy Plan|Free Plan/); f.h.unmount();
  }
});

test('a failed entitlement read shows plan unavailable without hiding the rest of the dashboard', async () => {
  const f = mobileFixture({ planFailure: true }); f.h.render(); await f.h.effects();
  assert.match(content(f.h.render()), /Plan unavailable/); assert.match(content(f.h.render()), /250\.00/); f.h.unmount();
});

test('mark read confirms the returned owned row before updating the mobile response', async () => {
  const f = mobileFixture(); f.h.render(); await f.h.effects(); f.tab('messages');
  await nodes(f.h.render()).find(n => n.type === 'button' && content(n) === 'Mark read').props.onClick();
  assert.deepEqual(f.writes[0].call.filters, [['id', 'response'], ['guard_id', 'guard']]);
  assert.equal(nodes(f.h.render()).filter(n => n.type === 'button' && content(n) === 'Mark read').length, 0);
  assert.doesNotMatch(content(f.h.render()), /could not be confirmed/); f.h.unmount();
});

test('failed, zero-row, mismatched and account-changed mark-read attempts retain the unread response and recovery action', async () => {
  for (const readResult of ['error', 'zero', 'unconfirmed', 'throw', 'changed']) {
    const f = mobileFixture({ readResult }); f.h.render(); await f.h.effects(); f.tab('messages');
    await nodes(f.h.render()).find(n => n.type === 'button' && content(n) === 'Mark read').props.onClick();
    assert.match(content(f.h.render()), /could not be confirmed/);
    assert.ok(nodes(f.h.render()).find(n => n.type === 'button' && content(n) === 'Mark read'));
    assert.doesNotMatch(content(f.h.render()), /private detail|private transport/); f.h.unmount();
  }
});

function limitsFixture() {
  const db = uiDatabase(), calls = []; let result = usage();
  db.rpc = async (name, args) => { calls.push({ name, args }); return { data: result, error: null }; };
  const h = hooksHarness('hooks/useUsageLimits.ts', { '@/lib/supabase': { supabase: db } });
  return { db, calls, h, render: id => h.renderComponent(h.exported.useUsageLimits, id), setResult: value => { result = value; } };
}

test('usage hook maps actual server keys into plan and reset dates for guard and client widgets', async () => {
  const f = limitsFixture(); f.render('owner'); await f.h.effects(); const api = f.render('owner');
  assert.equal(api.guardLimit.planName, 'Guard Elite'); assert.equal(api.guardLimit.planSlug, 'guard-elite');
  assert.equal(api.guardLimit.periodEnd, '2026-12-01T00:00:00Z'); assert.equal(api.clientLimit.periodStart, '2026-11-01T00:00:00Z');
  assert.equal(api.guardLimit.remaining, 36); assert.equal(api.error, null);
  assert.deepEqual(f.calls.map(c => c.args), [{ p_feature_key: 'guard_application' }, { p_feature_key: 'client_job_post' }]); f.h.unmount();
});

test('unlimited and no-entitlement usage responses preserve null limits and absent period dates', async () => {
  for (const value of [usage({ reason: 'unlimited', limit: null, remaining: null, period_end: undefined, period_start: undefined }),
    { allowed: false, reason: 'no_entitlement', limit: 0, used: 0, remaining: 0 }]) {
    const f = limitsFixture(); f.setResult(value); f.render('owner'); await f.h.effects();
    const api = f.render('owner'); assert.equal(api.guardLimit.limit, value.limit); assert.equal(api.guardLimit.periodEnd, '');
    assert.equal(api.guardLimit.allowed, value.allowed); f.h.unmount();
  }
});

test('usage errors and malformed replies clear old usage instead of retaining a previous healthy allowance', async () => {
  for (const mode of ['error', 'malformed', 'signed-out', 'changed']) {
    const f = limitsFixture(); f.render('owner'); await f.h.effects(); assert.ok(f.render('owner').guardLimit);
    if (mode === 'error') f.db.rpc = async () => ({ data: usage(), error: { message: 'private error' } });
    if (mode === 'malformed') f.setResult(usage({ remaining: '36' }));
    if (mode === 'signed-out') f.db.auth.getSession = async () => ({ data: { session: null }, error: null });
    if (mode === 'changed') f.db.rpc = async () => { f.db.owner = 'other'; return { data: usage(), error: null }; };
    await f.render('owner').refresh(); const api = f.render('owner');
    assert.equal(api.guardLimit, null); assert.equal(api.clientLimit, null); assert.equal(api.error, 'Failed to load usage limits'); f.h.unmount();
  }
});

test('late usage replies cannot overwrite a newer account or a null account', async () => {
  const f = limitsFixture(), pending = [];
  f.db.rpc = () => new Promise(resolve => pending.push(resolve));
  f.render('owner'); await f.h.effects(); assert.equal(pending.length, 2);
  f.db.owner = 'other'; f.render('other'); await f.h.effects(); assert.equal(pending.length, 4);
  pending[2]({ data: usage({ plan_name: 'Other Plan' }), error: null }); pending[3]({ data: usage(), error: null }); await flush();
  assert.equal(f.render('other').guardLimit.planName, 'Other Plan');
  pending[0]({ data: usage(), error: null }); pending[1]({ data: usage(), error: null }); await flush();
  assert.equal(f.render('other').guardLimit.planName, 'Other Plan');
  assert.equal(f.render(null).guardLimit, null); await f.h.effects(); assert.equal(f.render(null).loading, false); f.h.unmount();
});
