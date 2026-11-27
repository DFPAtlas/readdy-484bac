const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, flush } = require('./helpers/guard-ui-fixture.cjs');
const { clientPlanPresentation } = load('lib/client-plan-presentation.ts');
const plans = [
  { slug: 'client-starter', name: 'Client Starter', monthly_price_pence: 4900, features: ['client.post_job'] },
  { slug: 'client-pro', name: 'Client Pro', monthly_price_pence: 9900, features: ['client.post_job', 'client.analytics_dashboard'] },
  { slug: 'client-enterprise', name: 'Client Enterprise', monthly_price_pence: 19900, features: ['client.post_job', 'client.analytics_dashboard', 'client.unlimited_jobs'] },
];
const access = { plan_slug: 'client-enterprise', plan_name: 'Client Enterprise', is_active: true, is_free_tier: false, monthly_price_pence: 4900 };
const billing = { plan_slug: 'client-starter', plan_name: 'Client Starter', status: 'active', plan_amount: 4900, currency: 'gbp', billing_cycle: 'monthly', stripe_subscription_id: 'sub_fixture', current_period_end: '2026-12-04T09:46:00Z' };
const Link = { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) };

function fixture({ entitlement = access, subscription = billing, failure = null } = {}) {
  const rows = { user_entitlements_data: entitlement, subscriptions: subscription, plans };
  const calls = [], listeners = [];
  const db = {
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const q = { select: () => q, eq: (key, value) => { call.filters.push([key, value]); return q; }, order: () => q, maybeSingle: () => q,
        then: (yes, no) => Promise.resolve(table === failure ? { data: null, error: { message: 'private detail' } } : { data: rows[table], error: null }).then(yes, no) };
      return q;
    },
    channel() { const c = { on(kind, filter, callback) { listeners.push(callback); return c; }, subscribe: () => c }; return c; }, removeChannel() {},
  };
  const h = hooksHarness('components/PlanManagementCard.tsx', {
    'next/link': Link, '@/lib/supabase': { supabase: db },
    '@/components/PlanSwitchToast': { __esModule: true, default: () => null },
  }, { fetch: () => { throw new Error('Unexpected provider request'); } });
  const props = { userId: 'synthetic-client', audience: 'client' };
  return { h, rows, calls, listeners, props, async html() { h.render(props); await h.effects(); return renderToStaticMarkup(h.render(props)); } };
}

test('intentional Enterprise access never becomes Enterprise billing or a Pro upgrade', async () => {
  const before = JSON.stringify({ access, billing });
  const view = clientPlanPresentation(access, billing, plans);
  assert.equal(view.subscription.plan_name, 'Client Starter');
  assert.equal(view.subscription.priceLabel, '£49.00/month');
  assert.equal(view.differs, true);
  assert.equal(view.canRecommendPlanChange, false);
  assert.equal(JSON.stringify({ access, billing }), before);
  const f = fixture(); const html = await f.html();
  assert.match(html, /Billing plan/); assert.match(html, /Client Starter/);
  assert.match(html, /Current access:.*Client Enterprise/);
  assert.match(html, /Posting allowance follows your current access/);
  assert.match(html, /£49\.00\/month/);
  assert.doesNotMatch(html, /Upgrade to|Downgrade to|Unlock Analytics|£199/);
  assert.ok(f.calls.find(c => c.table === 'subscriptions').filters.some(([k,v]) => k === 'account_type' && v === 'client'));
  f.h.unmount();
});

test('ordinary Starter retains recommendations; Enterprise has no higher-tier offer', async () => {
  const starter = fixture({ entitlement: { ...access, plan_slug: billing.plan_slug, plan_name: billing.plan_name } });
  assert.match(await starter.html(), /Upgrade to Client Pro/); starter.h.unmount();
  const enterprise = fixture({ subscription: { ...billing, plan_slug: access.plan_slug, plan_name: access.plan_name, plan_amount: 19900 } });
  const html = await enterprise.html(); assert.match(html, /£199\.00\/month/); assert.doesNotMatch(html, /Upgrade to|Unlock Analytics/); enterprise.h.unmount();
});

test('annual, discounted and missing prices come from billing without inventing a monthly charge', () => {
  assert.equal(clientPlanPresentation(access, { ...billing, plan_amount: 9999, billing_cycle: 'annual' }, plans).subscription.priceLabel, '£99.99/year');
  assert.equal(clientPlanPresentation(access, { ...billing, plan_amount: 0 }, plans).subscription.priceLabel, '£0.00/month');
  assert.equal(clientPlanPresentation(access, { ...billing, plan_amount: null }, plans).subscription.priceLabel, 'Subscription price unavailable');
  assert.equal(clientPlanPresentation(access, { ...billing, billing_cycle: null }, plans).subscription.priceLabel, 'Subscription price unavailable');
});

test('missing or failed subscription reads never masquerade as free billing or expose controls', async () => {
  for (const options of [{ subscription: null }, { failure: 'subscriptions' }, { failure: 'user_entitlements_data' }, { failure: 'plans' }]) {
    const f = fixture(options); const html = await f.html();
    assert.match(html, /Subscription details unavailable/); assert.match(html, /Retry subscription details/);
    assert.doesNotMatch(html, /Free Plan|Cancel Subscription|Upgrade to|private detail|£49/); f.h.unmount();
  }
  const view = clientPlanPresentation(null, billing, plans);
  assert.equal(view.canRecommendPlanChange, false);
  assert.equal(view.accessName, 'Unavailable');
});

test('free access has no invented paid subscription and subscription-only records stay separate', () => {
  const free = clientPlanPresentation({ plan_slug: 'client_free', plan_name: 'Free Starter', is_active: true, is_free_tier: true }, null, plans);
  assert.equal(free.subscription.priceLabel, 'Free'); assert.equal(free.subscription.stripe_subscription_id, null);
  assert.equal(clientPlanPresentation(access, null, plans).subscription, null);
});

test('realtime refresh changes billing and identity change hides prior account immediately', async () => {
  const f = fixture(); await f.html();
  f.rows.subscriptions = { ...billing, plan_slug: 'client-pro', plan_name: 'Client Pro', plan_amount: 9900 };
  f.rows.user_entitlements_data = { ...access, plan_slug: 'client-pro', plan_name: 'Client Pro' };
  f.listeners[0](); await flush();
  const updated = renderToStaticMarkup(f.h.render(f.props));
  assert.match(updated, /£99\.00\/month/); assert.doesNotMatch(updated, /£49\.00\/month/);
  const switched = renderToStaticMarkup(f.h.render({ ...f.props, userId: 'other-client' }));
  assert.doesNotMatch(switched, /Client Pro|£99|Cancel Subscription/); f.h.unmount();
});

test('usage widget preserves authoritative finite/unlimited allowance without an invented reset', () => {
  const Widget = load('components/UsageLimitWidget.tsx', { 'next/link': Link }).default;
  const props = { featureLabel: 'Job Posts', icon: 'briefcase', planName: 'Client Enterprise', periodEnd: '', audience: 'client', limit: null, used: 0, remaining: null };
  const unlimited = renderToStaticMarkup(React.createElement(Widget, props));
  assert.match(unlimited, /Access: Client Enterprise/); assert.match(unlimited, /No monthly limit/); assert.doesNotMatch(unlimited, /Resets|date unavailable|Upgrade/);
  const finite = renderToStaticMarkup(React.createElement(Widget, { ...props, planName: 'Client Starter', limit: 10, used: 4, remaining: 6, periodEnd: '2026-12-04' }));
  assert.match(finite, /6<\/span>.*remaining/); assert.match(finite, /4 \/ 10 used/);
});

 test('denied or malformed usage never claims unlimited access or sells an upgrade', () => {
   const Widget = load('components/UsageLimitWidget.tsx', { 'next/link': Link }).default;
   for (const [allowed, reason, limit] of [[false, 'no_entitlement', 0], [false, 'unlimited', null], [true, 'unknown', null]]) {
     const html = renderToStaticMarkup(React.createElement(Widget, { featureLabel: 'Job Posts', icon: 'briefcase', planName: 'Unknown', periodEnd: '', audience: 'client', limit, used: 0, remaining: null, allowed, reason }));
     assert.match(html, /Posting allowance could not be confirmed/);
     assert.doesNotMatch(html, /No monthly limit|Upgrade/);
   }
 });
