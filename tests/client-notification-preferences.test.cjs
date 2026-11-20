const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const schema = require('./fixtures/client-notification-preferences-schema.json');
function load(path, mocks = {}, globals = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(m, m.exports, n => n in mocks ? mocks[n] : require(n), ...Object.values(globals));
  return m.exports;
}
const api = load('lib/client-notification-preferences.ts');
const C = 'client', U = 'user';
const choices = () => ({ ...api.CLIENT_NOTIFICATION_DEFAULTS, messages: false, in_app_alerts: false, email_frequency: 'none' });
const record = (extra = {}) => ({ id: 'preferences', user_id: U, ...choices(), job_matches: false, application_updates: false, payment_notifications: false, sia_reminders: false, last_digest_sent_at: '2026-11-01', last_weekly_digest_sent_at: '2026-11-02', ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 150; i++) await Promise.resolve(); };
function nodes(t) { return Array.isArray(t) ? t.flatMap(nodes) : t && typeof t === 'object' ? [t, ...nodes(t.props?.children)] : []; }
function text(t) { return Array.isArray(t) ? t.map(text).join('') : t && typeof t === 'object' ? text(t.props?.children) : t == null || typeof t === 'boolean' ? '' : String(t); }
function button(t, label) { const n = nodes(t).find(n => n.type === 'button' && text(n).trim() === label); assert.ok(n, 'Missing ' + label); return n; }
function database(options = {}) {
  let stored = options.empty ? null : record(options.row), listener;
  const calls = [];
  const db = { calls, user: U, get stored() { return stored; }, set stored(v) { stored = v; },
    auth: { getUser: async () => options.auth ? options.auth(db) : { data: { user: db.user ? { id: db.user, email: 'synthetic@example.test' } : null }, error: null },
      onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() { listener = null; } } } }; },
      async resetPasswordForEmail() { calls.push({ reset: true }); return options.reset ? options.reset() : { error: null }; },
    },
    authEvent(event, session) { listener?.(event, session); },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const normal = () => {
        for (const key of (call.fields || '').split(',').map(k => k.trim()).filter(Boolean)) assert.ok(schema[table].includes(key), 'Unknown column ' + key);
        for (const [key] of call.filters) assert.ok(schema[table].includes(key));
        if (table === 'clients') {
          const owner = { id: C, user_id: U, is_active: true, ...options.owner };
          return { data: !options.closed && call.filters.every(([k,v]) => owner[k] === v) ? owner : null, error: null };
        }
        if (call.op === 'insert') {
          if (stored) return { data: null, error: { code: '23505' } };
          stored = record(call.payload); return { data: { ...stored }, error: null };
        }
        const matched = stored && call.filters.every(([k,v]) => stored[k] === v);
        if (call.op === 'update' && matched) stored = { ...stored, ...call.payload };
        return { data: matched ? { ...stored } : null, error: null };
      };
      const q = { select(fields) { call.fields = fields; return q; }, eq(k,v) { call.filters.push([k,v]); return q; },
        update(payload) { call.op = 'update'; call.payload = payload; return q; }, insert(payload) { call.op = 'insert'; call.payload = payload; return q; },
        maybeSingle() { return q; }, then(a,b) { return Promise.resolve().then(() => options.query ? options.query(call, normal, db) : normal()).then(a,b); },
      }; return q;
    },
  }; return db;
}
function harness(options = {}) {
  const db = options.db || database(options), slots = [], effects = [], pending = [], messages = [], timers = new Map();
  let cursor = 0, writes = 0, scope = { id: C, user_id: U, email: 'synthetic@example.test' }, timerId = 0, confirmations = 0;
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { writes++; slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn,deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps,deps)) slots[i] = { fn,deps }; return slots[i].fn; },
    useEffect(fn,deps) { const i = cursor++; if (!effects[i] || !same(effects[i].deps,deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const Component = load('app/client/profile/PreferencesSection.tsx', { react: hooks, '@/lib/supabase': { supabase: db }, '@/lib/client-notification-preferences': api,
    '@/lib/client-payment-method': { paymentMethodView: () => ({ complete: false }) }, './PaymentMethodStatus': { __esModule: true, default: () => null },
  }, { confirm() { confirmations++; return options.confirm !== false; }, window: { location: { origin: 'https://example.test' } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
  }).default;
  const h = { db, messages, get writes() { return writes; }, get confirmations() { return confirmations; },
    render(profile = scope) { scope = profile; cursor = 0; return Component({ profile: scope, healthData: { profileComplete: false, billingAdded: false, firstJobPosted: false, notificationsSet: true, documentsUploaded: false }, paymentMethodState: { status: 'loading' }, onRefreshPaymentMethod() {}, onMessage(type,text) { messages.push({ type,text }); } }); },
    async effects() { pending.splice(0).forEach(fn => fn()); await flush(); }, async start() { this.render(); await this.effects(); return this.render(); },
    toggle(label) { nodes(this.render()).find(n => n.props?.role === 'switch' && n.props['aria-label'] === label).props.onClick(); },
    frequency(label) { button(this.render(),label).props.onClick(); }, async save() { await button(this.render(),'Save Preferences').props.onClick(); },
    runTimers() { const fns = [...timers.values()]; timers.clear(); fns.forEach(fn => fn()); }, unmount() { effects.forEach(e => e?.cleanup?.()); },
  }; return h;
}

test('owned settings preserve all false opt-outs, canonical frequencies and a minimal projection', async () => {
  for (const frequency of ['instant','daily','weekly','none','immediate']) {
    const db = database({ row: { email_frequency: frequency } });
    const saved = await api.loadClientNotificationPreferences(db,C,U);
    assert.equal(saved.exists,true); assert.equal(saved.preferences.messages,false); assert.equal(saved.preferences.in_app_alerts,false);
    assert.equal(saved.preferences.email_frequency,frequency === 'immediate' ? 'instant' : frequency);
    assert.equal(saved.preferences.job_matches,undefined);
    const read = db.calls.find(c => c.table === 'notification_preferences'); assert.deepEqual(read.filters,[['user_id',U]]);
    assert.doesNotMatch(read.fields,/job_matches|digest|sia_reminders|\*/);
  }
});

test('only a confirmed missing row permits unsaved defaults; malformed and failed reads block editing', async () => {
  const missing = await api.loadClientNotificationPreferences(database({ empty: true }),C,U);
  assert.equal(missing.exists,false); assert.deepEqual(missing.preferences,api.CLIENT_NOTIFICATION_DEFAULTS);
  for (const fault of ['error','throw','undefined','wrong','bad-frequency','bad-boolean']) {
    const db = database({ query(c,normal) {
      if (c.table !== 'notification_preferences') return normal();
      if (fault === 'throw') throw Error('PRIVATE_READ');
      if (fault === 'error') return { data: null, error: Error('PRIVATE_READ') };
      if (fault === 'undefined') return { data: undefined, error: null };
      return { data: record(fault === 'wrong' ? { user_id: 'foreign' } : fault === 'bad-frequency' ? { email_frequency: '__proto__' } : { messages: 'false' }), error: null };
    } });
    await assert.rejects(api.loadClientNotificationPreferences(db,C,U));
  }
  const nullable = await api.loadClientNotificationPreferences(database({ row: { sms_notifications: null, email_frequency: null } }),C,U);
  assert.equal(nullable.preferences.sms_notifications,false); assert.equal(nullable.preferences.email_frequency,'instant');
});

test('anonymous, foreign, inactive and closed accounts cannot read or write preferences; a final auth change is rejected', async () => {
  for (const options of [{ auth: () => ({ data: { user: null } }) }, { owner: { user_id: 'other' } }, { owner: { is_active: false } }, { closed: true }]) {
    const db = database(options); await assert.rejects(api.loadClientNotificationPreferences(db,C,U));
    await assert.rejects(api.saveClientNotificationPreferences(db,C,U,choices())); assert.equal(db.calls.some(c => c.op),false);
  }
  let n = 0; const changed = database({ auth: () => ({ data: { user: { id: ++n === 1 ? U : 'other' } } }) });
  await assert.rejects(api.loadClientNotificationPreferences(changed,C,U),/session changed/);
});

test('confirmed create/update touch only the client editable fields and preserve guard/digest bookkeeping', async () => {
  const db = database(), before = { ...db.stored }, submitted = { ...choices(), email_frequency: 'instant', messages: true, user_id: 'foreign', job_matches: true, last_digest_sent_at: 'changed' };
  const saved = await api.saveClientNotificationPreferences(db,C,U,submitted);
  assert.equal(saved.exists,true); assert.equal(saved.preferences.email_frequency,'instant');
  const write = db.calls.find(c => c.op); assert.equal(write.op,'update'); assert.deepEqual(write.filters,[['id','preferences'],['user_id',U]]);
  assert.equal(write.payload.user_id,undefined); assert.equal(write.payload.job_matches,undefined); assert.equal(write.payload.last_digest_sent_at,undefined);
  for (const key of ['job_matches','application_updates','payment_notifications','sia_reminders','last_digest_sent_at','last_weekly_digest_sent_at']) assert.equal(db.stored[key],before[key]);
  const fresh = database({ empty: true }); await api.saveClientNotificationPreferences(fresh,C,U,choices()); assert.equal(fresh.calls.find(c => c.op).payload.user_id,U);
  const reopened = await api.loadClientNotificationPreferences(db,C,U); assert.deepEqual(reopened.preferences,saved.preferences);
});

test('failed existence lookup cannot become an insert; invalid values, zero rows and mismatched returned saves never confirm', async () => {
  for (const failure of ['returned','thrown']) {
    const db = database({ query(c,normal) { if (c.table === 'notification_preferences') { if (failure === 'thrown') throw Error('PRIVATE_LOOKUP'); return { data: null, error: Error('PRIVATE_LOOKUP') }; } return normal(); } });
    await assert.rejects(api.saveClientNotificationPreferences(db,C,U,choices())); assert.equal(db.calls.some(c => c.op),false);
  }
  for (const input of [{ ...choices(), email_frequency: 'immediate' }, { ...choices(), messages: 'false' }]) {
    const db = database(); await assert.rejects(api.saveClientNotificationPreferences(db,C,U,input)); assert.equal(db.calls.length,0);
  }
  for (const data of [null,record({ id: 'wrong' }),record({ user_id: 'other' }),record({ messages: true })]) {
    const db = database({ query(c,normal) { return c.op ? { data, error: null } : normal(); } });
    await assert.rejects(api.saveClientNotificationPreferences(db,C,U,choices()));
  }
});

test('lost create acknowledgement can retry without duplicate settings; a conflicting concurrent insert is not overwritten', async () => {
  let lose = true; const db = database({ empty: true, query(c,normal) { if (c.op === 'insert' && lose) { lose = false; normal(); throw Error('PRIVATE_LOST_REPLY'); } return normal(); } });
  await assert.rejects(api.saveClientNotificationPreferences(db,C,U,choices()));
  await api.saveClientNotificationPreferences(db,C,U,choices()); assert.equal(db.calls.filter(c => c.op === 'insert').length,1); assert.equal(db.stored.messages,false);
  for (const matching of [true,false]) {
    const race = database({ empty: true, query(c,normal,db) { if (c.op === 'insert') { db.stored = record({ ...choices(), messages: matching ? false : true }); return { data: null, error: { code: '23505' } }; } return normal(); } });
    if (matching) assert.equal((await api.saveClientNotificationPreferences(race,C,U,choices())).exists,true);
    else await assert.rejects(api.saveClientNotificationPreferences(race,C,U,choices()));
    assert.equal(race.calls.some(c => c.op === 'update'),false);
  }
});

test('actual section hides editable defaults and health completion on failed reads, and Retry restores the saved opt-outs', async () => {
  let fail = true; const h = harness({ query(c,normal) { return fail && c.table === 'notification_preferences' ? { data: null, error: Error('PRIVATE_READ') } : normal(); } });
  await h.start(); assert.match(text(h.render()),/could not be loaded/); assert.equal(nodes(h.render()).some(n => n.props?.role === 'switch'),false);
  assert.match(text(h.render()),/0\/6 complete/); assert.doesNotMatch(text(h.render()),/PRIVATE_READ|Saved preferences confirmed/);
  fail = false; button(h.render(),'Retry loading preferences').props.onClick(); await flush();
  const switchNode = nodes(h.render()).find(n => n.props?.role === 'switch' && n.props['aria-label'] === 'Messages'); assert.equal(switchNode.props['aria-checked'],false);
  assert.match(text(h.render()),/1\/6 complete/); assert.equal(button(h.render(),'Off').props['aria-pressed'],true); h.unmount();
  const empty = harness({ empty: true }); await empty.start(); assert.match(text(empty.render()),/defaults until you save/); assert.match(text(empty.render()),/0\/6 complete/); empty.unmount();
});

test('returned/thrown/unconfirmed save failures keep choices, release Saving and permit Retry without private errors', async () => {
  for (const fault of ['returned','throw','zero']) {
    let fail = true; const h = harness({ empty: true, query(c,normal) { if (c.op && fail) { if (fault === 'throw') throw Error('PRIVATE_SAVE'); return { data: null, error: fault === 'returned' ? Error('PRIVATE_SAVE') : null }; } return normal(); } });
    await h.start(); h.toggle('Messages'); h.frequency('Weekly'); await h.save();
    assert.equal(h.messages.some(m => m.type === 'success'),false); assert.equal(button(h.render(),'Save Preferences').props.disabled,false);
    assert.equal(button(h.render(),'Weekly').props['aria-pressed'],true); assert.match(text(h.render()),/0\/6 complete/); assert.doesNotMatch(text(h.render()),/PRIVATE_SAVE/);
    fail = false; await h.save(); assert.equal(h.messages.at(-1).type,'success'); assert.equal(h.db.stored.email_frequency,'weekly'); assert.equal(h.db.stored.messages,false); assert.match(text(h.render()),/1\/6 complete/); h.unmount();
  }
});

test('rapid saves lock controls and dirty reload requires an explicit discard decision', async () => {
  const pending = deferred(); const h = harness({ confirm: false, query(c,normal) { return c.op ? pending.promise : normal(); } });
  await h.start(); h.frequency('Daily'); button(h.render(),'Reload saved preferences').props.onClick(); assert.equal(h.confirmations,1); assert.equal(button(h.render(),'Daily').props['aria-pressed'],true);
  const run = h.save(); const save = nodes(h.render()).find(n => n.type === 'button' && /Saving/.test(text(n))); await save.props.onClick(); await flush();
  assert.equal(h.db.calls.filter(c => c.op).length,1); assert.equal(nodes(h.render()).find(n => n.type === 'fieldset').props.disabled,true);
  h.frequency('Weekly'); pending.resolve({ data: record({ email_frequency: 'daily' }), error: null }); await run; assert.equal(button(h.render(),'Daily').props['aria-pressed'],true); h.unmount();
  const discard = harness(); await discard.start(); discard.frequency('Weekly'); button(discard.render(),'Reload saved preferences').props.onClick(); await flush(); assert.equal(button(discard.render(),'Off').props['aria-pressed'],true); discard.unmount();
});

test('account/client changes and unmount retire pending writes while same-user events preserve unsaved choices', async () => {
  for (const mode of ['account','unmount','client']) {
    const pending = deferred(); const h = harness({ query(c,normal) { return c.op ? pending.promise : normal(); } }); await h.start(); h.frequency('Weekly');
    h.db.authEvent('SIGNED_IN',{ user: { id: U } }); assert.equal(button(h.render(),'Weekly').props['aria-pressed'],true);
    const run = h.save(); await flush();
    if (mode === 'account') { h.db.user = 'other'; h.db.authEvent('SIGNED_IN',{ user: { id: 'other' } }); }
    else if (mode === 'client') { h.render({ id: 'other-client', user_id: 'other', email: 'other@example.test' }); await h.effects(); }
    else h.unmount();
    const count = h.writes; pending.resolve({ data: record({ email_frequency: 'weekly' }), error: null }); await run;
    assert.equal(h.messages.length,0); assert.equal(h.writes,count);
    if (mode !== 'unmount') { assert.equal(nodes(h.render()).some(n => n.props?.role === 'switch'),false); h.unmount(); }
  }
  const recover = harness(); await recover.start(); recover.db.user = null; recover.db.authEvent('SIGNED_OUT'); recover.runTimers(); await flush();
  assert.equal(nodes(recover.render()).some(n => n.props?.role === 'switch'),false);
  recover.db.user = U; recover.db.authEvent('SIGNED_IN',{ user: { id: U } }); recover.runTimers(); await flush();
  assert.equal(button(recover.render(),'Off').props['aria-pressed'],true); recover.unmount();
});

test('superseded preference reads and final-auth changes cannot install or confirm stale choices', async () => {
  const stale = deferred(), fresh = deferred(); let n = 0; const h = harness({ query(c,normal) { if (c.table !== 'notification_preferences') return normal(); if (++n === 1) return { data: null, error: Error('offline') }; return n === 2 ? stale.promise : fresh.promise; } });
  await h.start(); const retry = button(h.render(),'Retry loading preferences').props.onClick; retry(); await flush(); retry(); await flush();
  fresh.resolve({ data: record({ email_frequency: 'weekly' }), error: null }); await flush(); const count = h.writes;
  stale.resolve({ data: record({ email_frequency: 'daily' }), error: null }); await flush(); assert.equal(h.writes,count); assert.equal(button(h.render(),'Weekly').props['aria-pressed'],true); h.unmount();
  let countAuth = 0; const db = database({ auth: () => ({ data: { user: { id: ++countAuth === 1 ? U : 'other' } } }) });
  await assert.rejects(api.saveClientNotificationPreferences(db,C,U,choices()),/session changed/);
});

test('actual accessible controls use instant storage; password request failures release Sending and retired requests emit no toast', async () => {
  const h = harness({ row: { email_frequency: 'instant' }, reset: () => { throw Error('PRIVATE_RESET'); } }); await h.start();
  assert.equal(button(h.render(),'Immediate').props['aria-pressed'],true); const html = renderToStaticMarkup(h.render()); assert.match(html,/role="switch"/); assert.match(html,/aria-checked="false"/); assert.match(html,/Saving does not verify email or SMS delivery/);
  await button(h.render(),'Change Password').props.onClick(); assert.equal(button(h.render(),'Change Password').props.disabled,false); assert.doesNotMatch(JSON.stringify(h.messages.at(-1)),/PRIVATE_RESET/); h.unmount();
  const wait = deferred(); const late = harness({ reset: () => wait.promise }); await late.start(); const run = button(late.render(),'Change Password').props.onClick(); await flush(); late.unmount(); const count = late.writes; wait.resolve({ error: null }); await run; assert.equal(late.writes,count); assert.equal(late.messages.length,0);
  const parent = fs.readFileSync('app/client/profile/page.tsx','utf8'); assert.doesNotMatch(parent,/from\("notification_preferences"\)|notifPrefs=|onRefreshPrefs=/); assert.match(parent,/<PreferencesSection\s+key=/);
});
