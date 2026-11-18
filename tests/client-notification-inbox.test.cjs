const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('exports', compile(fs.readFileSync('lib/client-notification-inbox.ts', 'utf8')))(mod.exports);
const { loadClientNotificationInbox, changeClientNotifications } = mod.exports;
const filters = { category: 'all', priority: 'all', status: 'all', search: '', dateFrom: '', dateTo: '' };
const row = (id, isRead = false) => ({ id, user_id: 'owner', title: id, message: 'Update', category: 'general', type: 'general', priority: 0, is_read: isRead, read: isRead, created_at: '2026-11-18T10:00:00Z', link: null, data: null });
const snapshot = (rows = [row('a'), row('b')]) => ({ userId: 'owner', clientId: 'client', companyName: 'Example', notifications: rows });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };

function database() {
  const db = { calls: [], fault: '', signedIn: 'owner', rows: [row('a'), row('b')], returned: undefined,
    auth: { getUser: async () => db.fault === 'auth' ? { error: { message: 'private detail' } } : { data: { user: db.signedIn ? { id: db.signedIn } : null } } },
    from(table) {
      const call = { table, filters: [] }; db.calls.push(call);
      const result = () => {
        if (db.fault === table + '-throw') throw Error('private backend detail');
        if (db.fault === table) return { data: null, error: { message: 'private backend detail' } };
        if (db.fault === table + '-null') return { data: null, error: null };
        if (table === 'clients') return { data: { id: 'client', company_name: 'Example' } };
        if (db.returned !== undefined) return { data: db.returned, error: null };
        const requested = call.filters.find(f => f[0] === 'in')?.[2];
        return { data: db.rows.filter(r => !requested || requested.includes(r.id)).map(r => ({ ...r, ...call.patch })), error: null };
      };
      const q = {
        select(fields) { call.fields = fields; return q; },
        eq(key, value) { call.filters.push(['eq', key, value]); return q; },
        in(key, value) { call.filters.push(['in', key, value]); return q; },
        order(key, options) { call.order = [key, options]; return q; },
        or(value) { call.or = value; return q; }, gte(key, value) { call.from = [key,value]; return q; }, lte(key, value) { call.to = [key,value]; return q; },
        limit(value) { call.limit = value; return q; },
        update(patch) { call.action = 'update'; call.patch = patch; return q; }, delete() { call.action = 'delete'; return q; },
        maybeSingle: async () => result(), then: (resolve,reject) => Promise.resolve().then(result).then(resolve,reject),
      }; return q;
    },
  }; return db;
}

test('inbox reads apply owner and active filters, preserve zero priority and quote search punctuation', async () => {
  const db = database();
  const result = await loadClientNotificationInbox(db, { ...filters, category:'general', priority:'0', status:'unread', search:'job, "event"', dateFrom:'2026-11-01', dateTo:'2026-11-18' });
  assert.equal(result.notifications[0].priority, 0); assert.equal(result.companyName,'Example');
  assert.deepEqual(db.calls[0].filters, [['eq','user_id','owner']]);
  assert.deepEqual(db.calls[1].filters, [['eq','user_id','owner'],['eq','category','general'],['eq','priority',0],['eq','is_read',false]]);
  assert.equal(db.calls[1].or, 'title.ilike.' + JSON.stringify('%job, "event"%') + ',message.ilike.' + JSON.stringify('%job, "event"%'));
  assert.equal(db.calls[1].to[1], '2026-11-18T23:59:59.999'); assert.equal(db.calls[1].limit,100);
});

test('read errors and malformed results never become empty inboxes or missing-profile redirects', async () => {
  for (const fault of ['auth','clients','clients-throw','notifications','notifications-throw','notifications-null']) {
    const db=database();db.fault=fault;await assert.rejects(loadClientNotificationInbox(db,filters));
  }
  const signedOut=database();signedOut.signedIn=null;
  assert.equal((await loadClientNotificationInbox(signedOut,filters)).redirect,'/client/login');assert.equal(signedOut.calls.length,0);
  const missing=database();missing.fault='clients-null';
  assert.equal((await loadClientNotificationInbox(missing,filters)).redirect,'/client/complete-profile-wizard');assert.equal(missing.calls.length,1);
  const empty=database();empty.rows=[];assert.deepEqual((await loadClientNotificationInbox(empty,filters)).notifications,[]);
});

test('all writes verify current identity, scope to user and IDs, and confirm read flags or deleted rows', async () => {
  for (const action of ['mark_read','mark_unread','delete']) {
    const db=database();const result=await changeClientNotifications(db,'owner',['a','a'],action);
    assert.deepEqual(result,{confirmedIds:['a'],complete:true});
    assert.deepEqual(db.calls[0].filters,[['eq','user_id','owner'],['in','id',['a']]]);
    assert.equal(db.calls[0].fields,'id, user_id, is_read, read');
    if(action!=='delete')assert.deepEqual(db.calls[0].patch,{is_read:action==='mark_read',read:action==='mark_read'});
  }
  for (const fault of ['auth','changed','empty']) {
    const db=database();if(fault==='changed')db.signedIn='other';else db.fault=fault;
    await assert.rejects(changeClientNotifications(db,'owner',fault==='empty'?[]:['a'],'delete'));assert.equal(db.calls.length,0);
  }
});

test('returned, thrown, zero-row, wrong-owner and mismatched writes cannot confirm success; partial batches report confirmed IDs', async () => {
  for(const fault of ['notifications','notifications-throw','notifications-null']) {
    const db=database();db.fault=fault;await assert.rejects(changeClientNotifications(db,'owner',['a'],'mark_read'));
  }
  for(const returned of [[],[row('other',true)],[{...row('a',true),user_id:'other'}],[row('a')],[{...row('a',true),read:false}]]) {
    const db=database();db.returned=returned;assert.deepEqual(await changeClientNotifications(db,'owner',['a'],'mark_read'),{confirmedIds:[],complete:false});
  }
  const db=database();db.returned=[row('a',true)];assert.deepEqual(await changeClientNotifications(db,'owner',['a','b'],'mark_read'),{confirmedIds:['a'],complete:false});
});

const source=fs.readFileSync('app/client/notifications/page.tsx','utf8');
function harness(readFn=async()=>snapshot(),writeFn=async(_db,_user,ids)=>({confirmedIds:ids,complete:true})) {
  const body=source.slice(source.indexOf('  const router'),source.indexOf('  if (authLoading || !allowed)'));
  const slots=[],effects=[],pending=[],redirects=[],subscriptions=[];let cursor=0,writes=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,n)=>Object.is(v,b[n]));
  const hooks={
    useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},
    useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},
    useCallback(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={fn,deps};return slots[n].fn;},
    useEffect(fn,deps){const n=cursor++;if(!effects[n]||!same(effects[n].deps,deps))pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};});},
  };
  const router={replace:path=>redirects.push(path)};
  const channel={on(_event,filter,callback){subscriptions.push({filter,callback});return channel;},subscribe(){return channel;}};
  const db={channel:()=>channel,removeChannel(){}};
  const guard={loading:false,allowed:true};
  const env={...hooks,supabase:db,useRouter:()=>router,useClientGuard:()=>guard,loadClientNotificationInbox:readFn,changeClientNotifications:writeFn};
  const component=new Function(...Object.keys(env),compile(`return function(){${body}\nreturn {notifications,filtered,loading,loadError,userId,actionError,actionPending,markingAll,bulkMode,bulkProcessing,bulkAction,selectedNotifIds,setBulkMode,setActiveCategory,setActiveStatus,loadNotifications,markOneRead,deleteOne,markAllRead,toggleNotifSelection,runNotificationAction,selectAllNotifs,clearNotifSelection,handleNotifBulkAction};}`))(...Object.values(env));
  return{redirects,subscriptions,guard,get writes(){return writes;},render(){cursor=0;return component();},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('failed page load blocks writes, retries recover, and older success or failure cannot replace newer results',async()=>{
  const reads=[deferred(),deferred(),deferred(),deferred(),deferred(),deferred()];let n=0,changes=0;
  const r=harness(()=>reads[n++].promise,async()=>{changes++;});let api=r.render();await r.effects();
  await api.deleteOne('a');assert.equal(changes,0);reads[0].reject(Error('offline'));await flush();api=r.render();
  assert.equal(api.loadError,true);assert.equal(api.loading,false);assert.deepEqual(r.redirects,[]);await api.deleteOne('a');assert.equal(changes,0);
  const retry=api.loadNotifications();reads[1].resolve(snapshot());await retry;api=r.render();assert.equal(api.loadError,false);assert.equal(api.notifications.length,2);
  const older=api.loadNotifications(),newer=api.loadNotifications();reads[3].resolve(snapshot([row('new')]));await newer;const writes=r.writes;reads[2].resolve(snapshot([row('old')]));await older;assert.equal(r.writes,writes);assert.equal(r.render().notifications[0].id,'new');
  const oldFailure=api.loadNotifications(),fresh=api.loadNotifications();reads[5].resolve(snapshot());await fresh;reads[4].reject(Error('late failure'));await oldFailure;assert.equal(r.render().loadError,false);
});

test('single read/delete and mark-all failures preserve rows and reset processing; errors do not expose backend details',async()=>{
  for(const action of ['markOneRead','deleteOne','markAllRead']){
    const refresh=deferred();let reads=0;
    const r=harness(()=>reads++===0?Promise.resolve(snapshot()):refresh.promise,async()=>{throw Error('private detail');});r.render();await r.effects();let api=r.render();
    await api[action]('a');api=r.render();assert.deepEqual(api.notifications,snapshot().notifications);assert.match(api.actionError,/could not be confirmed/);assert.doesNotMatch(api.actionError,/private detail/);assert.equal(api.actionPending,false);assert.equal(api.markingAll,false);
    refresh.resolve(snapshot());await flush();assert.equal(r.render().loading,false);
  }
});

test('duplicate writes share a lock, leave rows unchanged until confirmed and affect only requested IDs',async()=>{
  const save=deferred(),refresh=deferred();let reads=0,changes=0;
  const r=harness(()=>reads++===0?Promise.resolve(snapshot()):refresh.promise,async()=>{changes++;return save.promise;});r.render();await r.effects();let api=r.render();
  const pending=api.markOneRead('a');await api.deleteOne('b');assert.equal(changes,1);assert.equal(r.render().notifications[0].is_read,false);assert.equal(r.render().actionPending,true);
  save.resolve({confirmedIds:['a'],complete:true});await pending;api=r.render();assert.equal(api.notifications[0].is_read,true);assert.equal(api.notifications[1].is_read,false);assert.equal(api.actionPending,false);
  refresh.resolve(snapshot([row('a',true),row('b')]));await flush();
});

test('partial bulk results keep unconfirmed selection and show a warning; successful deletions remove only acknowledged rows',async()=>{
  for(const action of ['mark_read','mark_unread','delete']){
    const refresh=deferred();let reads=0;
    const initial=snapshot([row('a',action==='mark_unread'),row('b',action==='mark_unread')]);
    const r=harness(()=>reads++===0?Promise.resolve(initial):refresh.promise,async()=>({confirmedIds:['a'],complete:false}));r.render();await r.effects();let api=r.render();
    api.setBulkMode(true);api.selectAllNotifs();api=r.render();await api.runNotificationAction(action,[...api.selectedNotifIds],true);api=r.render();
    assert.deepEqual([...api.selectedNotifIds],['b']);assert.equal(api.bulkMode,true);assert.equal(api.bulkProcessing,false);assert.equal(api.bulkAction,'');assert.match(api.actionError,/Some notification changes/);
    assert.equal(api.notifications.length,action==='delete'?1:2);assert.equal(api.notifications.find(n=>n.id==='b').is_read,action==='mark_unread');
    refresh.resolve(snapshot(api.notifications));await flush();
  }
});

test('filter changes during a save discard old reads and refresh the latest filter after confirmation',async()=>{
  const save=deferred(),refresh=deferred();const calls=[];
  const r=harness(async(_db,f)=>{calls.push({...f});return calls.length===1?snapshot():refresh.promise;},()=>save.promise);r.render();await r.effects();const api=r.render();
  const pending=api.markOneRead('a');api.setActiveCategory('payment');r.render();await r.effects();assert.equal(calls.length,1);
  save.resolve({confirmedIds:['a'],complete:true});await pending;assert.equal(calls.length,2);assert.equal(calls[1].category,'payment');
  refresh.resolve(snapshot([row('payment')]));await flush();assert.equal(r.render().notifications[0].id,'payment');
});

test('unmounted reads and mutations cannot set state or trigger another fetch',async()=>{
  const read=deferred();const r=harness(()=>read.promise);r.render();await r.effects();r.unmount();const before=r.writes;read.resolve(snapshot());await flush();assert.equal(r.writes,before);
  const save=deferred();let reads=0;const writer=harness(async()=>{reads++;return snapshot();},()=>save.promise);writer.render();await writer.effects();const pending=writer.render().deleteOne('a');writer.unmount();const writes=writer.writes;
  save.resolve({confirmedIds:['a'],complete:true});await pending;assert.equal(writer.writes,writes);assert.equal(reads,1);
});

test('loads wait for the client guard and realtime subscriptions use the app schema and verified owner',async()=>{
  let reads=0;const r=harness(async()=>{reads++;return snapshot();});r.guard.loading=true;r.guard.allowed=false;r.render();await r.effects();assert.equal(reads,0);
  r.guard.loading=false;r.guard.allowed=true;r.render();await r.effects();r.render();await r.effects();assert.equal(reads,1);
  assert.deepEqual(r.subscriptions.map(s=>s.filter),['INSERT','UPDATE'].map(event=>({event,schema:'app',table:'notifications',filter:'user_id=eq.owner'})));
});

test('rendered load errors have retry, never show the empty inbox message, and pending cards disable writes',()=>{
  let index=0;
  const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n===1?[false,()=>{}]:n===2?[true,()=>{}]:state;}};
  const page={exports:{}};new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:{}};if(name==='@/lib/client-notification-inbox')return mod.exports;
    if(name==='next/navigation')return{useRouter:()=>({replace(){}})};if(name==='@/hooks/useClientGuard')return{useClientGuard:()=>({loading:false,allowed:true})};
    if(name==='next/link'||name.startsWith('@/components/')||name.startsWith('./')||name.startsWith('../components/'))return{__esModule:true,default:()=>null};return require(name);
  },page.exports);
  const html=renderToStaticMarkup(React.createElement(page.exports.default));assert.match(html,/role="alert"/);assert.match(html,/Failed to load notifications/);assert.match(html,/>Retry</);assert.doesNotMatch(html,/You are all caught up/);
  const card={exports:{}};new Function('require','exports',compile(fs.readFileSync('app/client/notifications/NotificationCard.tsx','utf8')))(name=>{
    if(name==='@/lib/job-links')return{normalizeJobLink:value=>value};if(name==='next/link'||name.startsWith('./'))return{__esModule:true,default:()=>null};return require(name);
  },card.exports);
  const cardHtml=renderToStaticMarkup(React.createElement(card.exports.default,{...row('a'),disabled:true,onMarkRead(){},onDelete(){}}));assert.equal((cardHtml.match(/disabled=""/g)||[]).length,2);
});
