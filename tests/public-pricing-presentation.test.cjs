const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loader(options = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const resolve = id => {
      if (id === 'react') return options.react || React;
      if (id === 'next/navigation') return { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(options.search || '') };
      if (id === '@/lib/public-pricing' && options.fetchPublicPricing) return { ...load('lib/public-pricing.ts'), fetchPublicPricing: options.fetchPublicPricing };
      if (id === '@/lib/use-public-pricing') return { usePublicPricing: () => options.catalogue };
      if (id === '@/lib/supabase') return { supabase: {} };
      if (id === '@/lib/entitlements') return {};
      if (id === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children) };
      if (id === '@/components/pricing/PlanPrice') return load('components/pricing/PlanPrice.tsx');
      if (id.startsWith('@/components/')) return { __esModule: true, default: () => null };
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.')) { const target = path.join(path.dirname(file), id); return load(target + (fs.existsSync(target + '.ts') ? '.ts' : '.tsx')); }
      return require(id);
    };
    new Function('require', 'module', 'exports', js)(resolve, mod, mod.exports);
    return mod.exports;
  };
}
const load = loader();
const pricing = load('lib/public-pricing.ts');
const feeMath = load('lib/payg-fees.ts');
const plan = (slug, audience, monthly, limit, features = []) => ({ slug, name: slug, audience, monthly_price_pence: monthly,
  job_limit_per_month: limit, features, active: true, stripe_price_id: monthly ? 'price_month' : null,
  stripe_annual_price_id: monthly ? 'price_year' : null, description: 'Configured description' });
const rows = [plan('client_free', 'client', 0, 1), plan('client-starter', 'client', 6300, 12, ['client.job_history']),
  plan('guard_starter', 'guard', 0, 3, ['guard.advanced_alerts']), plan('guard-basic', 'guard', 1750, 14, ['guard.profile_boost'])];
const fees = [{ plan_slug: 'client_free', platform_fee_percent: 16, platform_fee_fixed_pence: 0 },
  { plan_slug: 'client-starter', platform_fee_percent: '8', platform_fee_fixed_pence: '25' }];
const catalogue = () => ({ ...pricing.buildPublicPricing(structuredClone(rows), structuredClone(fees)), loading: false, error: null, retry() {} });

function renderPage(file, { cycle = 'monthly', role = 'client', catalogue: value = catalogue(), search = '' } = {}) {
  const react = { ...React, useState(initial) {
    const state = React.useState(initial);
    if (initial === 'monthly') return [cycle, () => {}];
    if (file.includes('/help/') && initial === 'client') return [role, () => {}];
    if (file.includes('/upgrade/') && Array.isArray(initial)) return [value.plans, () => {}];
    if (file.includes('/upgrade/') && initial === true) return [false, () => {}];
    return state;
  } };
  const component = loader({ react, catalogue: value, search })(file).default;
  return renderToStaticMarkup(React.createElement(component));
}

test('catalogue changes, inactive plans, JSON features and fixed fees are reflected without copied values', () => {
  const data = catalogue();
  const starter = data.plans.find(p => p.slug === 'client-starter');
  assert.equal(starter.monthly_price_pence, 6300);
  assert.equal(pricing.planAllowanceText(starter), '12 job postings per month');
  assert.equal(pricing.bookingFeeText(starter), '8% + £0.25 per guard');
  const amounts = feeMath.calculatePaygFees({ hourlyRate: 15, hours: 8, numberOfGuards: 2, numberOfDays: 1,
    serviceFeePct: starter.bookingFee, serviceFeeFixedPence: starter.bookingFeeFixedPence });
  assert.equal(amounts.serviceFee, 19.70);
  assert.equal(amounts.total, 259.70);
  const changed = structuredClone(rows); changed[1].active = false;
  changed[3].features = JSON.stringify(['guard.advanced_alerts']);
  const updated = pricing.buildPublicPricing(changed, fees);
  assert.equal(updated.plans.some(p => p.slug === 'client-starter'), false);
  assert.deepEqual(updated.plans.find(p => p.slug === 'guard-basic').features, ['guard.advanced_alerts']);
});

test('missing, invalid, duplicate or failed fee rules never become a zero-fee estimate', () => {
  for (const bad of [null, '', true, -1, 101, 'not-a-number']) {
    const altered = structuredClone(fees); altered[1].platform_fee_percent = bad;
    const data = pricing.buildPublicPricing(rows, altered);
    assert.equal(data.feesError, true);
    assert.equal(data.plans.find(p => p.slug === 'client-starter').bookingFee, undefined);
  }
  for (const feeRows of [[], null, [...fees, fees[1]]]) assert.equal(pricing.buildPublicPricing(rows, feeRows).feesError, true);
  assert.equal(pricing.buildPublicPricing(rows, fees, true).plans.find(p => p.slug === 'client_free').bookingFee, undefined);
  assert.throws(() => pricing.buildPublicPricing([{ ...rows[0], monthly_price_pence: null }], fees), /configuration/);
  assert.throws(() => pricing.buildPublicPricing([...rows, rows[0]], fees), /configuration/);
});

test('annual total and monthly equivalent match checkout price validation, and missing annual prices stay unavailable', () => {
  const { matchesSubscriptionPrice } = load('supabase/functions/_shared/subscription-price.ts');
  for (const monthly of [4900, 9900, 1900, 1750]) {
    const selected = plan('selected', 'client', monthly, 10);
    const price = pricing.subscriptionPrice(selected, 'annual');
    assert.equal(price.billedPence, monthly * 10);
    assert.equal(price.monthlyEquivalentPence, monthly * 10 / 12);
    assert.equal(matchesSubscriptionPrice({ active: true, currency: 'gbp', product: 'prod', unit_amount: price.billedPence,
      recurring: { interval: 'year', interval_count: 1 } }, { ...selected, stripe_product_id: 'prod' }, 'annual'), true);
  }
  assert.equal(pricing.subscriptionPrice({ monthly_price_pence: 4900, stripe_annual_price_id: null }, 'annual'), null);
  assert.equal(pricing.subscriptionPrice({ monthly_price_pence: 0, stripe_annual_price_id: null }, 'annual').billedPence, 0);
  const html = renderToStaticMarkup(React.createElement(load('components/pricing/PlanPrice.tsx').default,
    { plan: plan('pro', 'client', 9900, 30), billingCycle: 'annual' }));
  assert.match(html, /£82\.50/); assert.match(html, /month equivalent/); assert.match(html, /£990\.00/);
  assert.doesNotMatch(html, /£990\.00<\/span>/);
});

test('pricing, upgrade and print pages render the same changed annual prices and implemented placement labels', () => {
  for (const file of ['app/pricing/PricingClient.tsx', 'app/upgrade/page.tsx', 'app/pricing/pdf/PricingPDFClient.tsx']) {
    const html = renderPage(file, { cycle: 'annual' });
    assert.match(html, /£52\.50/, file); assert.match(html, /£630\.00/, file);
    assert.match(html, /£14\.58/, file); assert.match(html, /£175\.00/, file);
    assert.match(html, /12 job postings per month/, file);
    assert.match(html, /14 applications per month/, file);
    assert.match(html, /Featured profile placement/, file);
    assert.doesNotMatch(html, /£490\.00|£49<|10 applications per month/, file);
  }
});

test('help calculator uses live fixed fees and guard help includes the configured free allowance', () => {
  const html = renderPage('app/help/HelpContent.tsx');
  assert.match(html, /8% \+ £0\.25 per guard/); assert.match(html, /£9\.85/); assert.match(html, /£129\.85/);
  const guard = renderPage('app/help/HelpContent.tsx', { role: 'guard' });
  assert.match(guard, /£17\.50/); assert.match(guard, /14 applications per month/); assert.match(guard, /3 applications per month/);
});

test('failed catalogue hides calculator prices and prevents printing until retry succeeds', () => {
  const failed = { plans: [], loading: false, error: 'Current pricing could not be confirmed.', feesError: false, retrievedAt: null, retry() {} };
  for (const file of ['app/help/HelpContent.tsx', 'app/pricing/pdf/PricingPDFClient.tsx']) {
    const html = renderPage(file, { catalogue: failed });
    assert.match(html, /Current pricing could not be confirmed/); assert.match(html, /Retry pricing/);
    assert.doesNotMatch(html, /£49|£99|£199/);
    if (file.includes('/pdf/')) assert.match(html, /disabled=""/);
  }
  const brokenFees = { ...catalogue(), feesError: true };
  const help = renderPage('app/help/HelpContent.tsx', { catalogue: brokenFees });
  assert.match(help, /No estimate is available/); assert.doesNotMatch(help, /£129\.85/);
});

test('loader queries active catalogue fields and narrow fee RPC; catalogue read errors are explicit', async () => {
  const calls = []; const query = { select(value) { calls.push(value); return this; }, eq(key, value) { calls.push([key, value]); return this; },
    order() { return Promise.resolve({ data: rows, error: null }); } };
  const client = { from(name) { calls.push(name); return query; }, async rpc(name) { calls.push(name); return { data: fees, error: null }; } };
  const data = await pricing.fetchPublicPricing(client);
  assert.equal(data.plans.length, 4); assert.ok(calls.includes('get_public_client_pricing_fees'));
  assert.deepEqual(calls.find(c => Array.isArray(c)), ['active', true]);
  query.order = async () => ({ data: null, error: { message: 'denied' } });
  await assert.rejects(pricing.fetchPublicPricing(client), /could not be loaded/);
});


test('an unavailable annual price is not invented or offered for subscription on pricing and upgrade pages', () => {
  const value = catalogue();
  value.plans = value.plans.map(plan => plan.monthly_price_pence ? { ...plan, stripe_annual_price_id: null } : plan);
  for (const file of ['app/pricing/PricingClient.tsx', 'app/upgrade/page.tsx', 'app/pricing/pdf/PricingPDFClient.tsx']) {
    const html = renderPage(file, { catalogue: value, cycle: 'annual' });
    assert.match(html, /Annual billing unavailable/);
    assert.doesNotMatch(html, /£630\.00|£52\.50|15% with annual/);
    if (!file.includes('/pdf/')) assert.match(html, /<button disabled=""[^>]*>Subscribe<\/button>/);
  }
});

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const flush = () => new Promise(resolve => setImmediate(resolve));
function pricingHookHarness(requests) {
  const states = [], effects = [], pending = []; let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useEffect(fn, deps) { const index = cursor++; const previous = effects[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pending.push(() => {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: fn() };
      }); },
  };
  const invokeHook = loader({ react, fetchPublicPricing: () => requests.shift().promise })('lib/use-public-pricing.ts').usePublicPricing;
  return { render() { cursor = 0; return invokeHook(); }, runEffects() { pending.splice(0).forEach(fn => fn()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); } };
}

test('pricing retry discards a superseded response and unmount ignores late completion', async () => {
  const old = deferred(), current = deferred(), late = deferred();
  const h = pricingHookHarness([old, current, late]); h.render(); h.runEffects();
  let api = h.render(); assert.equal(api.loading, true); assert.deepEqual(api.plans, []);
  api.retry(); h.render(); h.runEffects();
  old.resolve({ ...catalogue(), plans: [{ slug: 'stale' }] }); await flush();
  assert.deepEqual(h.render().plans, []);
  current.resolve(catalogue()); await flush(); api = h.render();
  assert.equal(api.loading, false); assert.equal(api.plans.length, 4);
  api.retry(); h.render(); h.runEffects(); api = h.render(); assert.equal(api.loading, true); assert.deepEqual(api.plans, []);
  h.unmount(); late.resolve({ ...catalogue(), plans: [{ slug: 'late' }] }); await flush();
  assert.deepEqual(h.render().plans, []);
});

test('pricing failure displays no catalogue and retry can recover current prices', async () => {
  const failed = deferred(), retry = deferred(); const h = pricingHookHarness([failed, retry]);
  h.render(); h.runEffects(); failed.reject(new Error('network failure')); await flush();
  let api = h.render(); assert.match(api.error, /could not be confirmed/); assert.deepEqual(api.plans, []); assert.equal(api.loading, false);
  api.retry(); h.render(); h.runEffects(); assert.equal(h.render().error, null);
  retry.resolve(catalogue()); await flush(); api = h.render(); assert.equal(api.plans.length, 4); assert.equal(api.error, null); h.unmount();
});
