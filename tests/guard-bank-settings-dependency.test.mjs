import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const service = { exports: {} }; new Function('exports', compile('lib/guard-payout-settings.ts'))(service.exports);
const ready = { connected: true, detailsSubmitted: true, payoutsEnabled: true, transfersEnabled: true, status: 'ready', requirementsDue: [], restrictedReason: null, lastCheckedAt: '2026-11-18T00:00:00Z' };
const notStarted = { ...ready, connected: false, detailsSubmitted: false, payoutsEnabled: false, transfersEnabled: false, status: 'not_started' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)); };

function harness() {
  const slots = [], effects = [], pending = [], writes = [], queries = [], requests = [], navigations = [];
  const authQueue = [], responseQueue = []; let cursor = 0, authListener, authReads = 0, subscriptions = 0;
  let sessionUser = 'user';
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { writes.push(i); slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || !same(effects[i].deps, deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const db = { auth: {
    getUser: () => { authReads++; return authQueue.shift() || Promise.resolve({ data: { user: sessionUser ? { id: sessionUser } : null }, error: null }); },
    getSession: async () => ({ data: { session: sessionUser ? { access_token: 'fixture', user: { id: sessionUser } } : null }, error: null }),
    onAuthStateChange(fn) { authListener = fn; subscriptions++; return { data: { subscription: { unsubscribe() { subscriptions--; } } } }; },
  }, from(table) { const q = { select(fields) { assert.equal(table, 'guards'); assert.equal(fields, 'id,full_name'); queries.push({ table, fields }); return q; },
    eq() { return q; }, maybeSingle: async () => ({ data: { id: 'guard', full_name: 'Current Guard' }, error: null }) }; return q; } };
  const net = async (url, options) => { requests.push({ url, options }); return await (responseQueue.shift() || Response.json(ready)); };
  const mod = { exports: {} };
  const dependency = { ...service.exports, requestGuardStripe: (client, endpoint, user, options) => service.exports.requestGuardStripe(client, endpoint, user, { ...options, fetcher: net }) };
  new Function('require', 'exports', 'window', compile('hooks/useGuardPayoutSettings.ts'))(name => name === 'react' ? react : name === '@/lib/supabase' ? { supabase: db } : dependency,
    mod.exports, { location: { assign: url => navigations.push(url) } });
  const invoke = mod.exports.useGuardPayoutSettings;
  return { authQueue, responseQueue, queries, requests, writes, navigations,
    get authReads() { return authReads; }, get subscriptions() { return subscriptions; },
    render(enabled = true) { cursor = 0; return invoke(enabled); },
    async runEffects() { pending.splice(0).forEach(fn => fn()); await flush(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
    changeAccount(user, event = 'SIGNED_IN') { sessionUser = user; authListener(event, user ? { user: { id: user } } : null); },
  };
}

test('bank settings waits for guard access, loads once and never requests nonexistent payout fields or legacy bank details', async () => {
  const h = harness(); h.render(false); await h.runEffects(); assert.equal(h.authReads, 0);
  h.render(true); await h.runEffects(); let state = h.render(); await h.runEffects(); state = h.render();
  assert.equal(state.profile.id, 'guard'); assert.equal(state.status.status, 'ready');
  assert.equal(h.authReads, 1); assert.equal(h.requests.length, 1); assert.equal(h.queries.length, 1);
  h.render(); await h.runEffects(); assert.equal(h.authReads, 1); assert.equal(h.subscriptions, 1);
  h.unmount(); assert.equal(h.subscriptions, 0);
});

test('superseded auth reads cannot replace a current profile or redirect, and late Stripe reads are ignored after cleanup', async () => {
  const h = harness(), oldAuth = deferred(), lateStatus = deferred();
  h.authQueue.push(oldAuth.promise); h.render(); await h.runEffects();
  await h.render().load(); assert.equal(h.render().profile.fullName, 'Current Guard');
  oldAuth.resolve({ data: { user: null }, error: null }); await flush();
  assert.equal(h.render().requiresLogin, false); assert.equal(h.render().profile.id, 'guard');
  h.responseQueue.push(lateStatus.promise); const refresh = h.render().refresh(); await flush();
  h.unmount(); const writes = h.writes.length; lateStatus.resolve(Response.json(notStarted)); await refresh;
  assert.equal(h.writes.length, writes); assert.deepEqual(h.navigations, []);
});

test('a failed status read stays unknown, blocks setup and can recover; older refreshes cannot overwrite the latest status', async () => {
  const h = harness(); h.responseQueue.push(Response.json({ error: 'down' }, { status: 500 }));
  h.render(); await h.runEffects(); const state = h.render();
  assert.equal(state.status, null); assert.match(state.statusError, /could not complete/);
  const before = h.requests.length; await state.openStripe('create-guard-connect-account'); assert.equal(h.requests.length, before);
  const old = deferred(); h.responseQueue.push(old.promise, Response.json(ready));
  const first = state.refresh(); await flush(); const second = h.render().refresh(); await second;
  assert.equal(h.render().status.status, 'ready');
  old.resolve(Response.json(notStarted)); await first; assert.equal(h.render().status.status, 'ready'); h.unmount();
});

test('Stripe actions are single-flight and a changed account suppresses a pending redirect', async () => {
  const h = harness(); h.render(); await h.runEffects(); const state = h.render();
  const link = deferred(); h.responseQueue.push(link.promise);
  const first = state.openStripe('create-guard-dashboard-link'); const second = state.openStripe('create-guard-dashboard-link'); await flush();
  assert.equal(h.requests.filter(r => r.url.includes('create-guard-dashboard-link')).length, 1);
  assert.deepEqual(JSON.parse(h.requests.at(-1).options.body), {});
  h.changeAccount('other'); assert.equal(h.render().profile, null); assert.equal(h.render().status, null);
  link.resolve(Response.json({ url: 'https://connect.stripe.com/express/fixture' })); await Promise.all([first, second]);
  assert.deepEqual(h.navigations, []); assert.match(h.render().error, /account has changed/); h.unmount();
});

test('Stripe action failures do not navigate or claim a save, and a valid owner link opens only after explicit action', async () => {
  const h = harness(); h.responseQueue.push(Response.json(notStarted)); h.render(); await h.runEffects();
  assert.deepEqual(h.navigations, []);
  h.responseQueue.push(Response.json({ url: 'https://evil.test/' })); await h.render().openStripe('create-guard-connect-account');
  assert.match(h.render().actionError, /invalid account link/); assert.deepEqual(h.navigations, []);
  h.responseQueue.push(Response.json({ url: 'https://connect.stripe.com/setup/fixture' })); await h.render().openStripe('create-guard-connect-account');
  assert.deepEqual(h.navigations, ['https://connect.stripe.com/setup/fixture']); assert.equal(h.render().actionError, ''); h.unmount();
});

test('sign-out during initialization invalidates the pending profile read and requests login', async () => {
  const h = harness(), auth = deferred(); h.authQueue.push(auth.promise); h.render(); await h.runEffects();
  h.changeAccount(null, 'SIGNED_OUT'); const count = h.writes.length;
  auth.resolve({ data: { user: { id: 'user' } }, error: null }); await flush();
  assert.equal(h.writes.length, count); assert.equal(h.render().requiresLogin, true); assert.equal(h.render().profile, null); h.unmount();
});
