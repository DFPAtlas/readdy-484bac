const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const helpers = { exports: require('./helpers/enterprise-module.cjs').load('lib/support-inbox-reads.ts') };

function mockDb(fault = '', malformed = false) {
  const calls = [];
  const data = {
    guards: [{ id: 'guard', full_name: 'Example guard', email: 'guard@example.test' }],
    clients: [{ id: 'client', company_name: 'Example client', email: 'client@example.test' }],
    support_tickets: [{ id: 'ticket', guard_id: 'guard', client_id: 'client', related_job_id: 'job' }],
    jobs: [{ id: 'job', job_title: 'Example job' }],
  };
  const result = table => table === fault ? { data: null, error: malformed ? null : { message: 'read denied' } } : { data: data[table], error: null };
  return { calls, data, auth: { getUser: async () => fault === 'auth' ? { data: {}, error: { message: 'auth unavailable' } } : { data: { user: { id: 'owner' } }, error: null } },
    from(table) { const call = { table, filters: [] }; calls.push(call); const q = {
      select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, in(key, value) { call.filters.push([key, value]); return q; }, order() { return q; },
      maybeSingle: async () => { const value = result(table); return { ...value, data: Array.isArray(value.data) ? value.data[0] || null : value.data }; },
      then(resolve, reject) { return Promise.resolve(result(table)).then(resolve, reject); },
    }; return q; },
  };
}

test('owner inboxes preserve authenticated profile/ticket/job scopes and only accept confirmed arrays', async () => {
  for (const kind of ['guard', 'client']) {
    const db = mockDb(); const snapshot = await helpers.exports.loadOwnedSupportInbox(db, kind);
    assert.equal(snapshot.userId, 'owner');
    assert.deepEqual(db.calls[0].filters, [['user_id', 'owner']]);
    assert.deepEqual(db.calls.find(c => c.table === 'support_tickets').filters, [[`${kind}_id`, kind], ['is_deleted', false]]);
    if (kind === 'client') { assert.equal(snapshot.tickets[0].job_title, 'Example job'); assert.deepEqual(db.calls.find(c => c.table === 'jobs').filters, [['client_id', 'client'], ['is_deleted', false]]); }
    for (const fault of ['auth', kind === 'guard' ? 'guards' : 'clients', 'support_tickets', ...(kind === 'client' ? ['jobs'] : [])]) {
      await assert.rejects(helpers.exports.loadOwnedSupportInbox(mockDb(fault), kind), /could not be/);
    }
    await assert.rejects(helpers.exports.loadOwnedSupportInbox(mockDb('support_tickets', true), kind), /could not be/);
    const empty = mockDb(); empty.data.support_tickets = [];
    assert.deepEqual((await helpers.exports.loadOwnedSupportInbox(empty, kind)).tickets, []);
  }
  const signedOut = mockDb(); signedOut.auth.getUser = async () => ({ data: { user: null }, error: null });
  assert.equal(await helpers.exports.loadOwnedSupportInbox(signedOut, 'guard'), null);
  assert.deepEqual(signedOut.calls, []);
});

test('admin ticket and enrichment failures cannot become empty inboxes or invented requester identities', async () => {
  for (const fault of ['support_tickets', 'clients', 'guards', 'jobs']) {
    await assert.rejects(helpers.exports.loadAdminSupportInbox(mockDb(fault)), /could not be/);
    await assert.rejects(helpers.exports.loadAdminSupportInbox(mockDb(fault, true)), /could not be/);
  }
  const empty = mockDb(); empty.data.support_tickets = [];
  assert.deepEqual(await helpers.exports.loadAdminSupportInbox(empty), []);
  assert.equal(empty.calls.length, 1, 'a confirmed empty inbox needs no enrichment reads');
});

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const sources = {
  guard: 'app/guard/support/SupportPage.tsx', client: 'app/client/support/SupportPage.tsx', admin: 'app/admin/support-tickets/page.tsx',
};
test('all three inboxes ignore old/closed-screen results and expose silent-refresh failures with retry recovery', async () => {
  for (const [kind,path] of Object.entries(sources)) {
    const source = fs.readFileSync(path,'utf8'), name = kind === 'admin' ? 'fetchTickets' : 'loadTickets';
    const start = source.indexOf(`  const ${name} = useCallback`), end = source.indexOf('\n  useEffect(',start), block = source.slice(start,end);
    const writes = [], redirects = [], reads = [deferred(),deferred(),deferred(),deferred(),deferred()]; let next=0;
    const env = { useCallback: fn=>fn, mountedRef: {current:true}, requestRef: {current:0},
      supabase: {}, expectedOwner: 'owner', withRequestDeadline: value => value, selectTicket: () => writes.push({key:'setSelected',value:null}), loadOwnedSupportInbox: ()=>reads[next++].promise, loadAdminSupportInbox: ()=>reads[next++].promise,
      router: {replace: path=>redirects.push(path)}, getInitials: ()=> 'EX', capitalize: s=>s,
      ...Object.fromEntries([...new Set([...block.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))].map(key=>[key,value=>writes.push({key,value})])),
    };
    const load = new Function(...Object.keys(env), compile(block+`\nreturn ${name};`))(...Object.values(env));
    const snapshot = kind === 'admin' ? [{id:'new'}] : {userId:'owner',profile:{id:kind,full_name:'Example',company_name:'Example'},jobs:[],tickets:[{id:'new'}]};
    const first = load(), second = load(true); reads[1].resolve(snapshot); await second;
    const count = writes.length; reads[0].reject(Error('older failure')); await first; assert.equal(writes.length,count);
    const third = load(true); reads[2].reject(Error('refresh failed')); await third;
    assert.equal(writes.filter(x=>x.key==='setLoadError').at(-1).value,true);
    const retry = load(); reads[3].resolve(snapshot); await retry;
    assert.equal(writes.filter(x=>x.key==='setLoadError').at(-1).value,false);
    const closed = load(); env.mountedRef.current=false; const closedCount=writes.length; reads[4].resolve(snapshot); await closed;
    assert.equal(writes.length,closedCount); assert.deepEqual(redirects,[]);
  }
});

test('error UI renders retry instead of an apparently empty inbox across all roles', () => {
  for (const [kind,path] of Object.entries(sources)) {
    let index=0; const loadingIndex=kind==='admin'?2:0, errorIndex=kind==='admin'?3:1;
    const hooks={...React,useState(initial){ const state=React.useState(initial), n=index++; return n===loadingIndex?[false,()=>{}]:n===errorIndex?[true,()=>{}]:state; }};
    const page={exports:{}};
    new Function('require','exports',compile(fs.readFileSync(path,'utf8')))(name=>{
      if(name==='react')return hooks;
      if(name==='@/lib/admin-support-ticket-writes'||name==='@/lib/client-support-writes')return {};
      if(name==='@/hooks/useMessageOwner')return {useMessageOwner:()=>({id:'owner',ready:true,revision:0})};
      if(name==='@/lib/support-routing')return {};
      if(name==='@/lib/request-deadline')return {withRequestDeadline:value=>value};
      if(name==='@/lib/supabase')return {supabase:{}};
      if(name==='@/lib/support-inbox-reads')return helpers.exports;
      if(name==='next/navigation')return {useRouter:()=>({replace(){}}),useSearchParams:()=>new URLSearchParams()};
      if(name.includes('useGuardGuard'))return {useGuardGuard:()=>({loading:false,allowed:true})};
      if(name.includes('useClientGuard'))return {useClientGuard:()=>({loading:false,allowed:true})};
      if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
      if(name.startsWith('@/components/')||name.startsWith('./')||name.includes('components/'))return {__esModule:true,default:()=>null};
      return require(name);
    },page.exports);
    const html=renderToStaticMarkup(React.createElement(page.exports.default));
    assert.match(html,/role="alert"/); assert.match(html,/Retry/); assert.doesNotMatch(html,/No tickets found|No support tickets yet/);
    assert.match(html,/—/,'failed totals are unknown rather than fresh zeroes');
  }
});
