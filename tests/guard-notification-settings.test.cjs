const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('exports', compile(fs.readFileSync('lib/guard-notification-settings.ts', 'utf8')))(mod.exports);
const { loadGuardNotificationSettings, saveGuardNotificationSettings } = mod.exports;
const prefs = { job_matches: false, application_updates: false, payment_notifications: false, messages: false, sia_reminders: false, email_frequency: 'none' };
const filters = { max_distance_miles: 25, min_hourly_rate: 10 };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
function database() {
  const calls = [], data = { notification_preferences: { user_id: 'owner', ...prefs }, guards: { user_id: 'owner', full_name: 'Example Guard', ...filters } };
  const db = { calls, data, fault: '', signedIn: 'owner',
    auth: { getUser: async () => db.fault === 'auth' ? { error: { message: 'auth unavailable' } } : { data: { user: db.signedIn ? { id: db.signedIn } : null } } },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const q = {
        select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; },
        upsert(row, options) { call.write = row; call.upsertOptions = options; return q; }, update(row) { call.write = row; return q; },
        async maybeSingle() {
          const fault = db.fault;
          if (fault === table + '-throw') throw Error('private backend detail');
          if (fault === table) return { data: null, error: { message: 'private backend detail' } };
          if (fault === table + '-empty') return { data: null, error: null };
          if (fault === table + '-wrong') return { data: { user_id: 'someone-else' }, error: null };
          return { data: call.write ? { user_id: 'owner' } : data[table], error: null };
        },
      }; return q;
    },
  }; return db;
}

test('successful reads preserve opt-outs and zero values, scoped to the verified owner', async () => {
  const db = database(); db.data.guards.min_hourly_rate = 0;
  const snapshot = await loadGuardNotificationSettings(db);
  assert.deepEqual(snapshot.preferences, prefs); assert.equal(snapshot.guardPreferences.min_hourly_rate, 0);
  assert.equal(snapshot.userId, 'owner'); assert.deepEqual(db.calls.map(c => c.filters), [[['user_id','owner']], [['user_id','owner']]]);
});

test('only a confirmed absent preferences row can use defaults; failed/invalid reads never become editable defaults', async () => {
  const empty = database(); empty.data.notification_preferences = null;
  assert.equal((await loadGuardNotificationSettings(empty)).preferences.job_matches, true);
  for (const fault of ['auth', 'notification_preferences', 'notification_preferences-throw', 'notification_preferences-wrong', 'guards', 'guards-empty', 'guards-throw', 'guards-wrong']) {
    const db = database(); db.fault = fault; await assert.rejects(loadGuardNotificationSettings(db));
  }
  const malformed = database(); malformed.data.notification_preferences.email_frequency = 'unsupported';
  await assert.rejects(loadGuardNotificationSettings(malformed), /could not be loaded/);
  const signedOut = database(); signedOut.signedIn = null;
  assert.equal(await loadGuardNotificationSettings(signedOut), null); assert.equal(signedOut.calls.length, 0);
});

test('saving confirms both owner rows and explicitly upserts by user_id', async () => {
  const db = database(); const result = await saveGuardNotificationSettings(db, 'owner', prefs, filters);
  assert.equal(result.success, true); assert.equal(db.calls.length, 2);
  assert.deepEqual(db.calls[0].upsertOptions, { onConflict: 'user_id' }); assert.equal(db.calls[0].write.messages, false);
  assert.deepEqual(db.calls[1].filters, [['user_id','owner']]); assert.deepEqual(db.calls[1].write, filters);
});

test('returned/thrown/zero-row/wrong-owner failures distinguish unconfirmed notification saves from partial saves', async () => {
  for (const table of ['notification_preferences', 'guards']) for (const suffix of ['', '-throw', '-empty', '-wrong']) {
    const db = database(); db.fault = table + suffix;
    const result = await saveGuardNotificationSettings(db, 'owner', prefs, filters);
    assert.equal(result.success, false); assert.doesNotMatch(result.message, /private backend detail/);
    if (table === 'guards') { assert.match(result.message, /Alert and email preferences were saved/); assert.equal(db.calls.length, 2); }
    else { assert.match(result.message, /could not be confirmed as saved/); assert.equal(db.calls.length, 1); }
  }
});

test('changed/unverified accounts and invalid filters cannot write preferences', async () => {
  for (const fault of ['auth', 'changed']) {
    const db = database(); if (fault === 'changed') db.signedIn = 'other'; else db.fault = fault;
    assert.equal((await saveGuardNotificationSettings(db, 'owner', prefs, filters)).success, false); assert.equal(db.calls.length, 0);
  }
  const db = database(); assert.equal((await saveGuardNotificationSettings(db, 'owner', prefs, { ...filters, min_hourly_rate: NaN })).success, false); assert.equal(db.calls.length, 0);
});

const source = fs.readFileSync('app/guard/notification-settings/page.tsx','utf8');
function harness(db, readFn) {
  const body = source.slice(source.indexOf('  const router'), source.indexOf('  const frequencyOptions'));
  const slots = [], effects = [], pending = [], redirects = []; let cursor = 0, writes = 0;
  const same = (a,b) => a && b && a.length === b.length && a.every((v,n) => Object.is(v,b[n]));
  const hooks = {
    useState(initial) { const n=cursor++; if (!(n in slots)) slots[n]=initial; return [slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}]; },
    useRef(initial) { const n=cursor++; if (!(n in slots)) slots[n]={current:initial}; return slots[n]; },
    useCallback(fn,deps) { const n=cursor++; if (!slots[n]||!same(slots[n].deps,deps)) slots[n]={fn,deps}; return slots[n].fn; },
    useEffect(fn,deps) { const n=cursor++; if (!effects[n]||!same(effects[n].deps,deps)) pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};}); },
  };
  const router = { replace: path => redirects.push(path) };
  const env = { ...hooks, supabase:db, useRouter:()=>router, useRouteGuard:()=>({checking:false,blocked:false}), useGuardGuard:()=>({loading:false,allowed:true}), loadGuardNotificationSettings:readFn, saveGuardNotificationSettings };
  const component = new Function(...Object.keys(env), compile(`return function(){${body}\nreturn {loading,loadError,userId,preferences,guardPreferences,toast,saving,loadPreferences,handleSave};}`))(...Object.values(env));
  return { redirects, get writes(){return writes;}, render(){cursor=0;return component();}, async effects(){pending.splice(0).forEach(fn=>fn());await flush();}, unmount(){effects.forEach(e=>e?.cleanup?.());} };
}
const snapshot = () => ({userId:'owner',preferences:{...prefs},guardPreferences:{...filters},displayName:'Example Guard',lastDigestSent:null,lastWeeklyDigestSent:null});

test('failed initial loads block saving until retry succeeds, and stale reads cannot replace newer preferences', async () => {
  const db=database(), reads=[deferred(),deferred(),deferred(),deferred()]; let n=0;
  const r=harness(db,()=>reads[n++].promise); let api=r.render(); await r.effects();
  await api.handleSave(); assert.equal(db.calls.length,0);
  reads[0].reject(Error('unavailable'));await flush();api=r.render();assert.equal(api.loadError,true);await api.handleSave();assert.equal(db.calls.length,0);assert.deepEqual(r.redirects,[]);
  const retry=api.loadPreferences();reads[1].resolve(snapshot());await retry;api=r.render();assert.equal(api.loadError,false);assert.equal(api.preferences.messages,false);
  const older=api.loadPreferences(),newer=api.loadPreferences();reads[3].resolve(snapshot());await newer;const count=r.writes;reads[2].resolve({...snapshot(),preferences:{...prefs,messages:true}});await older;assert.equal(r.writes,count);assert.equal(r.render().preferences.messages,false);
});

test('the page blocks rapid repeated saves, reports partial success, and ignores unmounted saves', async () => {
  const db=database();db.fault='guards-empty';const r=harness(db,async()=>snapshot());r.render();await r.effects();let api=r.render();
  await Promise.all([api.handleSave(),api.handleSave()]);api=r.render();assert.equal(db.calls.length,2);assert.equal(api.toast.success,false);assert.match(api.toast.message,/preferences were saved/);assert.equal(api.saving,false);
  const wait=deferred(),from=db.from;db.from=table=>{const q=from(table);q.maybeSingle=()=>wait.promise;return q;};
  const pending=api.handleSave();await flush();r.unmount();const count=r.writes;wait.resolve({data:{user_id:'owner'}});await pending;assert.equal(r.writes,count);
});

test('the error screen renders retry without editable defaults or a save button', () => {
  let index=0;
  const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n===0?[false,()=>{}]:n===1?[true,()=>{}]:state;}};
  const page={exports:{}};new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;
    if(name==='@/lib/supabase')return {supabase:{}};
    if(name==='@/lib/guard-notification-settings')return mod.exports;
    if(name==='next/navigation')return {useRouter:()=>({replace(){}})};
    if(name==='@/hooks/useRouteGuard')return {useRouteGuard:()=>({checking:false,blocked:false})};
    if(name==='@/hooks/useGuardGuard')return {useGuardGuard:()=>({loading:false,allowed:true})};
    if(name==='next/link'||name.startsWith('@/components/')||name.startsWith('./'))return {__esModule:true,default:()=>null};
    return require(name);
  },page.exports);
  const html=renderToStaticMarkup(React.createElement(page.exports.default));assert.match(html,/role="alert"/);assert.match(html,/Retry loading preferences/);assert.doesNotMatch(html,/Save Preferences|type="checkbox"|type="range"/);
});
