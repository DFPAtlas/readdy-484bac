const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('exports',compile(fs.readFileSync('lib/notification-snooze.ts','utf8')))(mod.exports);
const { saveGuardNotificationSnooze } = mod.exports;
const future = () => new Date(Date.now()+3600000).toISOString();
const row = (id, options={}) => ({id,title:id,message:'Update',type:'payment',is_read:false,link:null,created_at:new Date().toISOString(),snoozed_until:null,...options});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};

function database(){
  const db={calls:[],fault:'',owner:'guard',returned:undefined,auth:{getUser:async()=>db.fault==='auth'?{error:{message:'private detail'}}:{data:{user:{id:db.owner}}}},from(table){
    const call={table,filters:[]};db.calls.push(call);const q={
      update(value){call.patch=value;return q;},eq(key,value){call.filters.push([key,value]);return q;},select(value){call.fields=value;return q;},
      async maybeSingle(){if(db.fault==='throw')throw Error('network error');if(db.fault==='error')return{data:null,error:{message:'private detail'}};return{data:db.returned!==undefined?db.returned:{id:'a',user_id:'guard',snoozed_until:call.patch.snoozed_until?.replace('Z','+00:00')??null},error:null};},
    };return q;
  }};return db;
}

test('snooze and wake-up writes verify owner, scope to guard and ID, and accept equivalent persisted timestamp formats',async()=>{
  for(const until of [future(),null]){const db=database();assert.deepEqual(await saveGuardNotificationSnooze(db,'guard','a',until),{snoozedUntil:until});assert.deepEqual(db.calls[0].filters,[['user_id','guard'],['user_type','guard'],['id','a']]);assert.deepEqual(db.calls[0].patch,{snoozed_until:until});}
});

test('invalid or past snooze times and unverified accounts cannot write',async()=>{
  for(const until of [undefined,'invalid','2000-01-01T00:00:00Z','']){const db=database();await assert.rejects(saveGuardNotificationSnooze(db,'guard','a',until));assert.equal(db.calls.length,0);}
  for(const fault of ['auth','changed']){const db=database();if(fault==='auth')db.fault=fault;else db.owner='other';await assert.rejects(saveGuardNotificationSnooze(db,'guard','a',future()));assert.equal(db.calls.length,0);}
});

test('returned/thrown/zero-row/wrong-owner/wrong-ID or mismatched snooze acknowledgements cannot confirm a save',async()=>{
  for(const fault of ['throw','error']){const db=database();db.fault=fault;await assert.rejects(saveGuardNotificationSnooze(db,'guard','a',future()));}
  for(const returned of [null,{id:'a',user_id:'other',snoozed_until:future()},{id:'other',user_id:'guard',snoozed_until:future()},{id:'a',user_id:'guard',snoozed_until:null},{id:'a',user_id:'guard',snoozed_until:'not-a-date'}]){const db=database();db.returned=returned;await assert.rejects(saveGuardNotificationSnooze(db,'guard','a',future()));}
  const db=database();db.returned={id:'a',user_id:'guard',snoozed_until:future()};await assert.rejects(saveGuardNotificationSnooze(db,'guard','a',null));
});

const source=fs.readFileSync('app/guard/dashboard/NotificationHistory.tsx','utf8');
const pure=new Function(compile(source.slice(source.indexOf('function timeAgo'),source.indexOf('function SnoozeDropdown')))+'\nreturn {isSnoozed,formatDateLabel};')();
const body=source.slice(source.indexOf('  const [notifications,'),source.indexOf('  if (loading) {',source.indexOf('  const [notifications,')));
function harness(read=async()=>({data:[row('a'),row('b')]}),change=async(_db,_owner,ids)=>({confirmedIds:ids,complete:true}),snooze=async(_db,_owner,_id,until)=>({snoozedUntil:until})){
  const slots=[],effects=[],pending=[],queries=[],channels=[],removed=[],changes=[],snoozes=[],timers=new Map();let cursor=0,writes=0,timerId=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,n)=>Object.is(v,b[n]));
  const hooks={useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},useCallback(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={fn,deps};return slots[n].fn;},useMemo(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={value:fn(),deps};return slots[n].value;},useEffect(fn,deps){const n=cursor++;if(!effects[n]||!same(effects[n].deps,deps))pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};});}};
  const db={from(table){const call={table,filters:[]};queries.push(call);const q={select(value){call.fields=value;return q;},eq(key,value){call.filters.push([key,value]);return q;},order(key,value){call.order=[key,value];return q;},limit(value){call.limit=value;return read(call);}};return q;},channel(name){const c={name,on(_kind,_filter,callback){c.notify=callback;return c;},subscribe(){channels.push(c);return c;}};return c;},removeChannel:c=>removed.push(c)};
  const env={...hooks,...pure,supabase:db,changeOwnedNotifications:async(...args)=>{changes.push(args.slice(1));return change(...args);},saveGuardNotificationSnooze:async(...args)=>{snoozes.push(args.slice(1));return snooze(...args);},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  const component=new Function(...Object.keys(env),compile(`return function(guardUserId){${body}\nreturn {notifications,loading,loadError,actionError,actionPending,clearing,deletingId,showClearConfirm,confirmDeleteId,snoozeToast,filtered,paginated,page,visiblePage,totalPages,clearCount,clearIds:clearIdsRef.current,setPage,setTypeFilter,setReadFilter,setShowSnoozed,setConfirmDeleteId,fetchAll,markAsRead,markAllAsRead,openClearConfirm,clearAll,deleteNotification,snoozeNotification,unsnoozeNotification};}`))(...Object.values(env));
  let owner='guard';return{queries,channels,removed,changes,snoozes,timers,get writes(){return writes;},render(next=owner){owner=next;cursor=0;return component(owner);},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('load errors and malformed results show retry, block actions, and a successful retry restores history',async()=>{
  for(const failure of [{data:null,error:{message:'private detail'}},{data:null},Error('offline')]){
    let reads=0;const r=harness(async()=>{if(reads++===0){if(failure instanceof Error)throw failure;return failure;}return{data:[row('retry')]};});r.render();await r.effects();let api=r.render();assert.equal(api.loadError,true);assert.equal(api.loading,false);await api.deleteNotification('a');assert.equal(r.changes.length,0);await api.fetchAll();api=r.render();assert.equal(api.loadError,false);assert.equal(api.notifications[0].id,'retry');
  }
  const empty=harness(async()=>({data:[]}));empty.render();await empty.effects();assert.equal(empty.render().loadError,false);assert.deepEqual(empty.render().notifications,[]);assert.deepEqual(empty.queries[0].filters,[['user_id','guard'],['user_type','guard']]);assert.equal(empty.queries[0].limit,200);
});

test('older successes and failures, prior accounts, and unmounted reads cannot overwrite current history',async()=>{
  const older=deferred(),newer=deferred();let reads=0;const r=harness(()=>reads++===0?older.promise:newer.promise);r.render('A');await r.effects();r.render('B');await r.effects();newer.resolve({data:[row('B')]});await flush();const count=r.writes;older.reject(Error('late failure'));await flush();assert.equal(r.writes,count);assert.equal(r.render().notifications[0].id,'B');
  const stale=deferred();const oldRead=harness(()=>stale.promise);oldRead.render();await oldRead.effects();oldRead.unmount();const writes=oldRead.writes;stale.resolve({data:[]});await flush();assert.equal(oldRead.writes,writes);
});

test('all failed mutations preserve existing rows, reset controls and avoid false snooze confirmations',async()=>{
  for(const method of ['markAsRead','deleteNotification','snoozeNotification','unsnoozeNotification']){
    const refresh=deferred();let reads=0;const fail=async()=>{throw Error('private detail');};const r=harness(()=>reads++===0?Promise.resolve({data:[row('a')]}):refresh.promise,fail,fail);r.render();await r.effects();assert.equal(await r.render()[method]('a',future()),false);const api=r.render();assert.deepEqual(api.notifications,[row('a',{created_at:api.notifications[0].created_at})]);assert.equal(api.actionPending,false);assert.equal(api.deletingId,null);assert.equal(api.clearing,false);assert.equal(api.snoozeToast.show,false);assert.match(api.actionError,/could not be confirmed/);assert.doesNotMatch(api.actionError,/private detail/);refresh.resolve({data:api.notifications});await flush();
  }
});

test('a shared lock blocks rapid overlapping read, delete, snooze and wake-up requests',async()=>{
  const save=deferred(),refresh=deferred();let reads=0;const r=harness(()=>reads++===0?Promise.resolve({data:[row('a'),row('b')]}):refresh.promise,()=>save.promise);r.render();await r.effects();const api=r.render();const pending=api.markAsRead('a');await api.deleteNotification('b');await api.snoozeNotification('b',future());await api.unsnoozeNotification('b');assert.equal(r.changes.length,1);assert.equal(r.snoozes.length,0);assert.equal(r.render().notifications[0].is_read,false);save.resolve({confirmedIds:['a'],complete:true});await pending;assert.equal(r.render().notifications[0].is_read,true);assert.equal(r.render().notifications[1].is_read,false);refresh.resolve({data:r.render().notifications});await flush();
});

test('mark-all uses only unread notifications matching the current type/status/snooze filters',async()=>{
  const refresh=deferred();let reads=0;const rows=[row('a'),row('read',{is_read:true}),row('other',{type:'message'}),row('snoozed',{snoozed_until:future()})];const r=harness(()=>reads++===0?Promise.resolve({data:rows}):refresh.promise);r.render();await r.effects();r.render().setTypeFilter('payment');r.render().setReadFilter('unread');await r.render().markAllAsRead();assert.deepEqual(r.changes[0],['guard',['a'],'mark_read']);refresh.resolve({data:[]});await flush();
});

test('clear-all freezes confirmed IDs and partial results keep unconfirmed IDs instead of deleting later arrivals',async()=>{
  const finalRead=deferred();let reads=0;const r=harness(()=>++reads===1?Promise.resolve({data:[row('a'),row('b')]}):reads===2?Promise.resolve({data:[row('a'),row('b'),row('new')]}):finalRead.promise,async()=>({confirmedIds:['a'],complete:false}));r.render();await r.effects();r.render().openClearConfirm();await r.render().fetchAll();r.render();await r.effects();assert.deepEqual(r.render().clearIds,['a','b']);await r.render().clearAll();const api=r.render();assert.deepEqual(r.changes[0],['guard',['a','b'],'delete']);assert.deepEqual(api.notifications.map(n=>n.id),['b','new']);assert.deepEqual(api.clearIds,['b']);assert.equal(api.showClearConfirm,true);assert.match(api.actionError,/Some notification changes/);assert.equal(api.clearing,false);finalRead.resolve({data:[row('b'),row('new')]});await flush();
});

test('the clear confirmation count follows captured IDs that disappear during a refresh',async()=>{
  let reads=0;const r=harness(async()=>({data:reads++===0?[row('a'),row('b')]:[row('b'),row('new')]}));r.render();await r.effects();r.render().openClearConfirm();assert.equal(r.render().clearCount,2);
  await r.render().fetchAll();r.render();await r.effects();assert.deepEqual(r.render().clearIds,['b']);assert.equal(r.render().clearCount,1);assert.equal(r.render().showClearConfirm,true);
});

test('clear-all failures retain confirmation and zero-row acknowledgements never remove displayed notifications',async()=>{
  for(const result of ['throw','empty']){const refresh=deferred();let reads=0;const r=harness(()=>reads++===0?Promise.resolve({data:[row('a')]}):refresh.promise,async()=>{if(result==='throw')throw Error('offline');return{confirmedIds:[],complete:false};});r.render();await r.effects();r.render().openClearConfirm();await r.render().clearAll();const api=r.render();assert.equal(api.showClearConfirm,true);assert.deepEqual(api.clearIds,['a']);assert.equal(api.notifications.length,1);assert.equal(api.clearing,false);assert.ok(api.actionError);refresh.resolve({data:[row('a')]});await flush();}
});

test('snooze and wake-up apply confirmed timestamps only, and toast timers are cancelled on unmount',async()=>{
  const refresh=deferred();let reads=0;const r=harness(()=>reads++===0?Promise.resolve({data:[row('a')]}):refresh.promise);r.render();await r.effects();const until=future();assert.equal(await r.render().snoozeNotification('a',until),true);let api=r.render();assert.equal(api.notifications[0].snoozed_until,until);assert.equal(api.snoozeToast.show,true);assert.equal(r.timers.size,1);const timer=[...r.timers.values()][0];refresh.resolve({data:api.notifications});await flush();r.unmount();assert.equal(r.timers.size,0);const writes=r.writes;timer();assert.equal(r.writes,writes);
  const wakeRead=deferred();reads=0;const wake=harness(()=>reads++===0?Promise.resolve({data:[row('a',{snoozed_until:until})]}):wakeRead.promise);wake.render();await wake.effects();assert.equal(await wake.render().unsnoozeNotification('a'),true);api=wake.render();assert.equal(api.notifications[0].snoozed_until,null);assert.equal(api.snoozeToast.show,false);assert.equal(wake.timers.size,0);wakeRead.resolve({data:api.notifications});await flush();
});

test('deleting the last item on the final page immediately shows the previous page',async()=>{
  const refresh=deferred();let reads=0;const rows=Array.from({length:16},(_,n)=>row(String(n)));const r=harness(()=>reads++===0?Promise.resolve({data:rows}):refresh.promise);r.render();await r.effects();r.render().setPage(2);assert.equal(r.render().paginated.length,1);await r.render().deleteNotification('15');assert.equal(r.render().visiblePage,1);assert.equal(r.render().paginated.length,15);refresh.resolve({data:rows.slice(0,15)});await flush();r.render();await r.effects();assert.equal(r.render().page,1);
});

test('account switches or unmounts discard delayed mutations and do not trigger another refresh',async()=>{
  for(const switchAccount of [true,false]){const save=deferred();const r=harness(async call=>({data:[row(call.filters[0][1])]}),()=>save.promise);r.render('A');await r.effects();const pending=r.render().deleteNotification('A');if(switchAccount){r.render('B');await r.effects();}else r.unmount();const count=r.writes,reads=r.queries.length;save.resolve({confirmedIds:['A'],complete:true});await pending;assert.equal(r.writes,count);assert.equal(r.queries.length,reads);if(switchAccount)assert.equal(r.render().notifications[0].id,'B');}
});

test('rendered load failure exposes retry instead of empty history, and pending writes disable mutation controls',()=>{
  function render(overrides){let index=0;const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n in overrides?[overrides[n],()=>{}]:state;}};const component={exports:{}};new Function('require','exports',compile(source))(name=>{
    if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:{}};if(name==='@/lib/client-notification-inbox')return{changeClientNotifications(){}};if(name==='@/lib/notification-snooze')return mod.exports;if(name==='@/lib/job-links')return{normalizeJobLink:value=>value};if(name==='next/link')return{__esModule:true,default:()=>null};return require(name);
  },component.exports);return renderToStaticMarkup(React.createElement(component.exports.default,{guardUserId:'guard'}));}
  const failed=render({1:false,15:true});assert.match(failed,/role="alert"/);assert.match(failed,/Retry loading history/);assert.doesNotMatch(failed,/No notifications found|0 total/);
  const pending=render({0:[row('a')],1:false,17:true});assert.ok((pending.match(/disabled=""/g)||[]).length>=7);
  const error=render({0:[row('a')],1:false,16:'Notification changes could not be confirmed.'});assert.match(error,/role="alert"/);assert.match(error,/Reload history/);
});
