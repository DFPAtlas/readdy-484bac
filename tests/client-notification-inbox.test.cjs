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
      const call = { table, filters: [], orders: [] }; db.calls.push(call);
      const result = () => {
        if (db.fault === table + '-throw') throw Error('private backend detail');
        if (db.fault === table) return { data: null, error: { message: 'private backend detail' } };
        if (db.fault === table + '-null') return { data: null, error: null };
        if (table === 'clients') return { data: { id: 'client', company_name: 'Example' } };
        if (db.response) return db.response(call);
        if (db.returned !== undefined) return { data: db.returned, count:db.returned?.length, error: null };
        const requested = call.filters.find(f => f[0] === 'in')?.[2];
        const rows=db.rows.filter(r => !requested || requested.includes(r.id)).map(r => ({ ...r, ...call.patch }));
        return { data: call.range?rows.slice(call.range[0],call.range[1]+1):call.limit?rows.slice(0,call.limit):rows, count:rows.length, error: null };
      };
      const q = {
        select(fields,options) { call.fields = fields; call.options=options; return q; },
        eq(key, value) { call.filters.push(['eq', key, value]); return q; },
        in(key, value) { call.filters.push(['in', key, value]); return q; },
        order(key, options) { call.orders.push([key, options]); return q; },
        or(value) { call.or = value; return q; }, gte(key, value) { call.from = [key,value]; return q; }, lte(key, value) { call.to = [key,value]; return q; },
        limit(value) { call.limit = value; return q; },
        range(from,to) { call.range=[from,to]; return q; },
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
  assert.equal(db.calls[1].to[1], '2026-11-18T23:59:59.999'); assert.deepEqual(db.calls[1].range,[0,99]);
  assert.deepEqual(db.calls[1].options,{count:'exact'});
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

const history = size => Array.from({length:size},(_,i)=>row(`n${String(i).padStart(3,'0')}`));

test('complete history loads all 405 owned records with stable ordering and filters on every page',async()=>{
  const db=database();db.rows=history(405);
  const active={...filters,category:'general',priority:'0',status:'unread',search:'event, "update"',dateFrom:'2026-11-01',dateTo:'2026-11-18'};
  const result=await loadClientNotificationInbox(db,active,'owner');
  assert.deepEqual(result.notifications.map(n=>n.id),db.rows.map(n=>n.id));
  const pages=db.calls.filter(c=>c.table==='notifications');
  assert.deepEqual(pages.map(c=>c.range),[[0,99],[100,199],[200,299],[300,399],[400,499]]);
  for(const page of pages){
    assert.deepEqual(page.filters,[['eq','user_id','owner'],['eq','category','general'],['eq','priority',0],['eq','is_read',false]]);
    assert.deepEqual(page.orders,[['created_at',{ascending:false,nullsFirst:false}],['id',{ascending:false}]]);
    assert.deepEqual(page.options,{count:'exact'});
    assert.equal(page.or,pages[0].or);assert.deepEqual(page.from,pages[0].from);assert.deepEqual(page.to,pages[0].to);
  }
});

test('exact totals handle empty and full pages and server caps smaller than the requested range',async()=>{
  for(const size of [0,100,200,405]){
    const db=database();db.rows=history(size);
    db.response=call=>({data:db.rows.slice(call.range[0],Math.min(call.range[0]+23,call.range[1]+1)),count:size});
    const result=await loadClientNotificationInbox(db,filters,'owner');
    assert.equal(result.notifications.length,size);assert.equal(db.calls.length,1+Math.max(1,Math.ceil(size/23)));
  }
});

test('later page errors, missing totals, changed totals, duplicates and foreign rows cannot return a partial inbox',async()=>{
  for(const fault of ['returned','thrown','missing-count','changed-count','duplicate','foreign','empty','too-many','over-count']){
    const db=database();db.rows=history(205);
    db.response=call=>{
      const offset=call.range[0];let data=db.rows.slice(offset,offset+100),count=db.rows.length;
      if(offset>0){
        if(fault==='returned')return{data:null,error:{message:'private detail'}};
        if(fault==='thrown')throw Error('private detail');
        if(fault==='missing-count')count=null;
        if(fault==='changed-count')count=204;
        if(fault==='duplicate')data[0]=db.rows[0];
        if(fault==='foreign')data[0]={...data[0],user_id:'foreign'};
        if(fault==='empty')data=[];
        if(fault==='too-many')data=db.rows.slice(0,101);
      }
      if(fault==='over-count')count=1;
      return{data,count};
    };
    await assert.rejects(loadClientNotificationInbox(db,filters,'owner'));
    assert.ok(db.calls.length<=3,`must stop at first unverifiable page: ${fault}`);
  }
});

test('retired and changed-owner history loads stop paging and cannot return their earlier rows',async()=>{
  const db=database();db.rows=history(205);let active=true;
  db.response=call=>{active=false;return{data:db.rows.slice(call.range[0],call.range[1]+1),count:205};};
  await assert.rejects(loadClientNotificationInbox(db,filters,'owner',()=>active),/retired/);assert.equal(db.calls.length,2);
  const changed=database();changed.rows=history(205);let authCalls=0;
  changed.auth.getUser=async()=>({data:{user:{id:authCalls++<3?'owner':'other'}}});
  await assert.rejects(loadClientNotificationInbox(changed,filters,'owner'),/notification owner/);assert.equal(changed.calls.length,3);
  const retired=database();await assert.rejects(loadClientNotificationInbox(retired,filters,'owner',()=>false),/retired/);assert.equal(retired.calls.length,0);
});

test('an inbox load cannot replace the expected screen with another authenticated owner', async () => {
  const db=database();db.signedIn='other';
  await assert.rejects(loadClientNotificationInbox(db,filters,'owner'),/notification owner/);
  assert.equal(db.calls.length,0);
});

test('account changes during profile and inbox reads discard rows and missing-profile redirects', async () => {
  for (const boundary of ['profile','inbox']) {
    for (const nextOwner of ['other',null,'auth-error']) {
      const db=database();let calls=0;
      db.auth.getUser=async()=>{
        const current=calls++ < (boundary==='profile'?1:2) ? 'owner' : nextOwner;
        return current==='auth-error'?{error:{message:'private detail'}}:{data:{user:current?{id:current}:null}};
      };
      if(boundary==='profile')db.fault='clients-null';
      await assert.rejects(loadClientNotificationInbox(db,filters,'owner'),/notification owner/);
      assert.equal(db.calls.length,boundary==='profile'?1:2);
    }
  }
});

test('late read and delete acknowledgements are not reported to a different or signed-out account', async () => {
  for(const action of ['mark_read','mark_unread','delete']) {
    for(const nextOwner of ['other',null]) {
      const db=database();let calls=0;
      db.auth.getUser=async()=>({data:{user:calls++===0?{id:'owner'}:nextOwner?{id:nextOwner}:null}});
      await assert.rejects(changeClientNotifications(db,'owner',['a'],action),/notification owner/);
      assert.deepEqual(db.calls[0].filters,[['eq','user_id','owner'],['in','id',['a']]]);
    }
  }
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
test('auth events immediately replace the inbox identity and wait for the matching guard; refreshes keep the same inbox',()=>{
  let observed=null,notify,cleanup,active=true,updates=0;
  const guard={loading:false,allowed:true,userId:'owner'};
  const page={exports:{}};
  const hooks={...React,useRef:()=>({current:'owner'}),useState:()=>[observed,value=>{observed=typeof value==='function'?value(observed):value;updates++;}],useEffect:fn=>{if(active){cleanup=fn();active=false;}}};
  const db={auth:{onAuthStateChange(callback){notify=callback;return{data:{subscription:{unsubscribe(){}}}};}}};
  new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:db};
    if(name==='@/hooks/useClientGuard')return{useClientGuard:()=>guard};
    if(name==='@/lib/client-notification-inbox')return mod.exports;
    if(name==='next/navigation')return{};
    if(name==='next/link'||name.startsWith('@/components/')||name.startsWith('./')||name.startsWith('../components/'))return{__esModule:true,default:()=>null};
    return require(name);
  },page.exports);
  const render=()=>page.exports.default();
  assert.equal(render().key,'owner:0');
  notify('SIGNED_IN',{user:{id:'other'}});
  let screen=render();assert.equal(screen.key,'other:1');assert.equal(screen.props.allowed,false);
  guard.userId='other';screen=render();assert.equal(screen.props.allowed,true);
  notify('TOKEN_REFRESHED',{user:{id:'other'}});assert.equal(render().key,'other:1');
  notify('SIGNED_OUT',null);screen=render();assert.equal(screen.key,'signed-out:2');assert.equal(screen.props.expectedUserId,null);assert.equal(screen.props.allowed,false);
  notify('SIGNED_IN',{user:{id:'other'}});const beforeBatched=render().key;
  notify('SIGNED_OUT',null);notify('SIGNED_IN',{user:{id:'other'}});
  assert.notEqual(render().key,beforeBatched,'batched sign-out/sign-in must still retire the original inbox');
  cleanup();const before=updates;notify('SIGNED_IN',{user:{id:'owner'}});assert.equal(updates,before);
});

function harness(readFn=async()=>snapshot(),writeFn=async(_db,_user,ids)=>({confirmedIds:ids,complete:true})) {
  const body='const {loading:authLoading,allowed,userId:expectedUserId}=useClientGuard();\n'+source.slice(source.indexOf('  const router'),source.indexOf('  if (authLoading || !allowed ||'));
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
  const guard={loading:false,allowed:true,userId:'owner'};
  const env={...hooks,INBOX_PAGE_SIZE:25,supabase:db,useRouter:()=>router,useClientGuard:()=>guard,loadClientNotificationInbox:readFn,changeClientNotifications:writeFn};
  const component=new Function(...Object.keys(env),compile(`return function(){${body}\nreturn {notifications,filtered,pageNotifications,page,totalPages,selectedPageIds,changePage,setSortBy,loading,loadError,userId,actionError,actionPending,markingAll,bulkMode,bulkProcessing,bulkAction,selectedNotifIds,setBulkMode,setActiveCategory,setActiveStatus,loadNotifications,markOneRead,deleteOne,markAllRead,toggleNotifSelection,runNotificationAction,selectAllNotifs,clearNotifSelection,handleNotifBulkAction};}`))(...Object.values(env));
  return{redirects,subscriptions,guard,get writes(){return writes;},render(){cursor=0;return component();},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('all 405 rows are reachable in 25-row pages and page, filter and sort changes clear selection',async()=>{
  const r=harness(async()=>snapshot(history(405)));r.render();await r.effects();let api=r.render();
  assert.equal(api.notifications.length,405);assert.equal(api.totalPages,17);assert.equal(api.pageNotifications.length,25);
  api.selectAllNotifs();api=r.render();assert.equal(api.selectedPageIds.length,25);
  api.changePage(17);api=r.render();assert.deepEqual(api.pageNotifications.map(n=>n.id),['n400','n401','n402','n403','n404']);assert.equal(api.selectedNotifIds.size,0);
  api.selectAllNotifs();api=r.render();assert.equal(api.selectedPageIds.length,5);
  api.setSortBy('urgent_first');r.render();await r.effects();api=r.render();assert.equal(api.page,1);assert.equal(api.selectedNotifIds.size,0);
  api.changePage(17);api=r.render();api.setActiveCategory('general');r.render();await r.effects();api=r.render();assert.equal(api.page,1);
});

test('mark-page-read only submits displayed unread IDs and pagination is locked until confirmation',async()=>{
  const save=deferred(),refresh=deferred(),calls=[];let reads=0;
  const r=harness(()=>reads++===0?Promise.resolve(snapshot(history(405))):refresh.promise,async(_db,owner,ids,action)=>{calls.push({owner,ids,action});return save.promise;});
  r.render();await r.effects();let api=r.render();api.changePage(2);api=r.render();
  const pending=api.markAllRead();r.render().changePage(17);assert.equal(r.render().page,2);assert.equal(calls[0].ids.length,25);assert.equal(calls[0].ids[0],'n025');assert.equal(calls[0].ids.at(-1),'n049');
  save.resolve({confirmedIds:calls[0].ids,complete:true});await pending;api=r.render();assert.equal(api.notifications.filter(n=>n.is_read).length,25);assert.equal(api.notifications.find(n=>n.id==='n400').is_read,false);
  refresh.resolve(snapshot(api.notifications));await flush();
});

test('bulk and single actions cannot submit hidden-page IDs, and deleting the last page clamps to remaining rows',async()=>{
  const refresh=deferred();let reads=0;const calls=[];
  const r=harness(()=>reads++===0?Promise.resolve(snapshot(history(26))):refresh.promise,async(_db,_owner,ids)=>{calls.push(ids);return{confirmedIds:ids,complete:true};});
  r.render();await r.effects();let api=r.render();api.changePage(2);api=r.render();
  await api.markOneRead('n000');assert.equal(calls.length,0);api.toggleNotifSelection('n000');assert.equal(r.render().selectedNotifIds.size,0);
  await api.runNotificationAction('delete',['n000','n025'],true);api=r.render();assert.deepEqual(calls,[['n025']]);assert.equal(api.page,1);assert.equal(api.totalPages,1);assert.equal(api.pageNotifications.length,25);assert.equal(api.notifications[0].id,'n000');
  refresh.resolve(snapshot(api.notifications));await flush();
});

test('a later history-page failure shows Retry and blocks actions until a complete reload succeeds',async()=>{
  const db=database();db.rows=history(205);let failure=true,changes=0;
  db.response=call=>failure&&call.range[0]>0?{data:null,error:{message:'private detail'}}:{data:db.rows.slice(call.range[0],call.range[1]+1),count:205};
  const r=harness(()=>loadClientNotificationInbox(db,filters,'owner'),async()=>{changes++;});r.render();await r.effects();let api=r.render();
  assert.equal(api.loadError,true);assert.equal(api.notifications.length,0);await api.markAllRead();assert.equal(changes,0);
  failure=false;await api.loadNotifications();api=r.render();assert.equal(api.loadError,false);assert.equal(api.notifications.length,205);assert.equal(api.totalPages,9);
});

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
  const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n===2?[false,()=>{}]:n===3?[true,()=>{}]:state;}};
  const page={exports:{}};new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:{}};if(name==='@/lib/client-notification-inbox')return mod.exports;
    if(name==='next/navigation')return{useRouter:()=>({replace(){}})};if(name==='@/hooks/useClientGuard')return{useClientGuard:()=>({loading:false,allowed:true,userId:'owner'})};
    if(name==='next/link'||name.startsWith('@/components/')||name.startsWith('./')||name.startsWith('../components/'))return{__esModule:true,default:()=>null};return require(name);
  },page.exports);
  const html=renderToStaticMarkup(React.createElement(page.exports.default));assert.match(html,/role="alert"/);assert.match(html,/Failed to load notifications/);assert.match(html,/>Retry</);assert.doesNotMatch(html,/You are all caught up/);
  const card={exports:{}};new Function('require','exports',compile(fs.readFileSync('app/client/notifications/NotificationCard.tsx','utf8')))(name=>{
    if(name==='@/lib/job-links')return{normalizeJobLink:value=>value};if(name==='next/link'||name.startsWith('./'))return{__esModule:true,default:()=>null};return require(name);
  },card.exports);
  const cardHtml=renderToStaticMarkup(React.createElement(card.exports.default,{...row('a'),disabled:true,onMarkRead(){},onDelete(){}}));assert.equal((cardHtml.match(/disabled=""/g)||[]).length,2);
});

test('rendered history shows only its last five cards with correct range, navigation and page action wording',()=>{
  let index=0;const rows=history(405);
  const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;
    if(n===1)return[rows,()=>{}];if(n===2||n===3)return[false,()=>{}];if(n===4)return['owner',()=>{}];if(n===5)return['client',()=>{}];if(n===13)return[17,()=>{}];return state;
  }};
  const page={exports:{}};new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:{}};if(name==='@/lib/client-notification-inbox')return mod.exports;
    if(name==='next/navigation')return{useRouter:()=>({replace(){}})};if(name==='@/hooks/useClientGuard')return{useClientGuard:()=>({loading:false,allowed:true,userId:'owner'})};
    if(name==='./NotificationCard')return{__esModule:true,default:props=>React.createElement('article',{'data-notification':props.id})};
    if(name==='../components/BulkActionBar')return{__esModule:true,default:props=>React.createElement('div',{'data-page-selection-total':props.totalCount})};
    if(name==='next/link'||name.startsWith('@/components/')||name.startsWith('./')||name.startsWith('../components/'))return{__esModule:true,default:()=>null};return require(name);
  },page.exports);
  const html=renderToStaticMarkup(React.createElement(page.exports.default));
  assert.equal((html.match(/data-notification=/g)||[]).length,5);assert.match(html,/data-notification="n400"/);assert.doesNotMatch(html,/data-notification="n399"/);
  assert.match(html,/Showing 401–405 of 405 · Page 17 of 17/);assert.match(html,/aria-label="Notification pages"/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Next<\/button>/);assert.match(html,/Mark Page Read/);assert.doesNotMatch(html,/Mark All Read/);assert.match(html,/data-page-selection-total="5"/);
});
