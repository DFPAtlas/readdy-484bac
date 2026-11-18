const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const source = fs.readFileSync('app/client/dashboard/NotificationsPanel.tsx', 'utf8');
const body = source.slice(source.indexOf('  const [open,'), source.indexOf('  return (\n    <div', source.indexOf('  const [open,')));
const getActionButton = new Function(compile(source.slice(source.indexOf('function getActionButton'), source.indexOf('interface InboxScope'))) + '\nreturn getActionButton;')();
const row = (id, is_read = false) => ({ id, title: id, message: 'Update', type: 'general', category: 'general', priority: 0, is_read, created_at: '2026-11-18T10:00:00Z', link: '/client/jobs' });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n=0;n<30;n++) await Promise.resolve(); };

function harness(readFn = async () => ({data:[row('a'),row('b')]}), changeFn = async (_db,_owner,ids) => ({confirmedIds:ids,complete:true})) {
  const slots=[],effects=[],pending=[],channels=[],removed=[],queries=[],changes=[],routes=[];let cursor=0,writes=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,n)=>Object.is(value,b[n]));
  const hooks={
    useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},
    useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},
    useEffect(fn,deps){const n=cursor++;if(!effects[n]||!same(effects[n].deps,deps))pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};});},
  };
  const db={
    from(table){const call={table,filters:[],orders:[]};queries.push(call);const q={select(value){call.fields=value;return q;},eq(key,value){call.filters.push([key,value]);return q;},order(key,value){call.orders.push([key,value]);return q;},limit(value){call.limit=value;return readFn(call);}};return q;},
    channel(name){const channel={name,filters:[],on(_kind,filter,notify){channel.filters.push(filter);channel.notify=notify;return channel;},subscribe(){channels.push(channel);return channel;}};return channel;},
    removeChannel(channel){removed.push(channel);},
  };
  const router={push:path=>routes.push(path)};
  const env={...hooks,supabase:db,useRouter:()=>router,getActionButton,normalizeJobLink:value=>value,document:{addEventListener(){},removeEventListener(){}},changeClientNotifications:async(...args)=>{changes.push(args.slice(1));return changeFn(...args);}};
  const component=new Function(...Object.keys(env),compile(`return function(userId){${body}\nreturn {open,notifications,loading,loadError,actionError,actionPending,unreadCount,markAllRead,markOneRead,handleActionClick,handleToggle,retryLoad};}`))(...Object.values(env));
  let owner='owner';
  return{queries,channels,removed,changes,routes,get writes(){return writes;},render(nextOwner=owner){owner=nextOwner;cursor=0;return component(owner);},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}

test('returned, thrown and malformed initial reads show errors, block writes, and retry can recover',async()=>{
  for(const failure of [{data:null,error:{message:'private detail'}},{data:null,error:null},Error('offline')]){
    let reads=0;const r=harness(async()=>{if(reads++===0){if(failure instanceof Error)throw failure;return failure;}return{data:[row('retry')]};});r.render();await r.effects();let api=r.render();
    assert.equal(api.loadError,true);assert.equal(api.loading,false);await api.markAllRead();await api.markOneRead('a');assert.equal(r.changes.length,0);
    api.retryLoad();await flush();api=r.render();assert.equal(api.loadError,false);assert.equal(api.notifications[0].id,'retry');
  }
});

test('empty results are successful and queries stay scoped to the client owner and twenty latest items',async()=>{
  const r=harness(async()=>({data:[]}));r.render();await r.effects();const api=r.render();assert.equal(api.loadError,false);assert.equal(api.loading,false);assert.deepEqual(api.notifications,[]);
  assert.deepEqual(r.queries[0].filters,[['user_id','owner'],['user_type','client']]);assert.equal(r.queries[0].limit,20);
  assert.deepEqual(r.channels[0].filters,['INSERT','UPDATE'].map(event=>({event,schema:'app',table:'notifications',filter:'user_id=eq.owner'})));
  const empty=harness();empty.render('');await empty.effects();assert.equal(empty.queries.length,0);assert.equal(empty.render().loadError,true);
});

test('failed single and mark-all actions keep the existing unread rows and recover pending controls',async()=>{
  for(const method of ['markOneRead','markAllRead']){
    const refresh=deferred();let reads=0;const r=harness(()=>reads++===0?Promise.resolve({data:[row('a'),row('b')]}):refresh.promise,async()=>{throw Error('private detail');});r.render();await r.effects();
    assert.equal(await r.render()[method]('a'),false);const api=r.render();assert.equal(api.notifications.filter(n=>!n.is_read).length,2);assert.equal(api.actionPending,false);assert.match(api.actionError,/could not be confirmed/);assert.doesNotMatch(api.actionError,/private detail/);
    refresh.resolve({data:[row('a'),row('b')]});await flush();assert.equal(r.render().loading,false);
  }
});

test('read actions wait for acknowledged rows and share a synchronous duplicate-click lock',async()=>{
  const save=deferred(),refresh=deferred();let reads=0;
  const r=harness(()=>reads++===0?Promise.resolve({data:[row('a'),row('b')]}):refresh.promise,()=>save.promise);r.render();await r.effects();const api=r.render();
  const pending=api.markOneRead('a');await api.markAllRead();assert.equal(r.changes.length,1);assert.deepEqual(r.changes[0],['owner',['a'],'mark_read']);assert.equal(r.render().actionPending,true);assert.equal(r.render().notifications[0].is_read,false);
  save.resolve({confirmedIds:['a'],complete:true});assert.equal(await pending,true);assert.equal(r.render().notifications[0].is_read,true);assert.equal(r.render().notifications[1].is_read,false);assert.equal(r.render().actionPending,false);
  refresh.resolve({data:[row('a',true),row('b')]});await flush();
});

test('partial or zero-row acknowledgements show a warning and update only confirmed IDs',async()=>{
  for(const confirmedIds of [[],['a']]){
    const refresh=deferred();let reads=0;const r=harness(()=>reads++===0?Promise.resolve({data:[row('a'),row('b')]}):refresh.promise,async()=>({confirmedIds,complete:false}));r.render();await r.effects();
    assert.equal(await r.render().markAllRead(),false);const api=r.render();assert.equal(api.notifications[0].is_read,confirmedIds.includes('a'));assert.equal(api.notifications[1].is_read,false);assert.match(api.actionError,/Some read changes/);assert.equal(api.actionPending,false);
    refresh.resolve({data:api.notifications});await flush();
  }
});

test('notifications arriving during mark-all stay unread after the authoritative refresh',async()=>{
  const save=deferred(),refresh=deferred();let reads=0;
  const r=harness(()=>reads++===0?Promise.resolve({data:[row('a')]}):refresh.promise,()=>save.promise);r.render();await r.effects();const pending=r.render().markAllRead();r.channels[0].notify();await flush();assert.equal(reads,1);
  save.resolve({confirmedIds:['a'],complete:true});await pending;assert.equal(reads,2);refresh.resolve({data:[row('new'),row('a',true)]});await flush();assert.equal(r.render().unreadCount,1);assert.equal(r.render().notifications[0].is_read,false);
});

test('an unconfirmed automatic mark-read keeps the dropdown open; confirmed actions navigate after saving',async()=>{
  for(const complete of [false,true]){
    const save=deferred();const r=harness(async()=>({data:[row('a')]}),()=>save.promise);r.render();await r.effects();r.render().handleToggle();const pending=r.render().handleActionClick(row('a'));assert.equal(r.routes.length,0);assert.equal(r.render().open,true);
    save.resolve({confirmedIds:complete?['a']:[],complete});await pending;assert.equal(r.routes.length,complete?1:0);assert.equal(r.render().open,!complete);
  }
});

test('closing the dropdown during a save cancels the delayed action navigation',async()=>{
  const save=deferred();const r=harness(async()=>({data:[row('a')]}),()=>save.promise);r.render();await r.effects();r.render().handleToggle();
  const pending=r.render().handleActionClick(row('a'));r.render().handleToggle();assert.equal(r.render().open,false);
  save.resolve({confirmedIds:['a'],complete:true});await pending;assert.deepEqual(r.routes,[]);assert.equal(r.render().open,false);
});

test('account changes discard previous reads and pending writes, including delayed navigation',async()=>{
  const read=deferred();const r=harness(call=>call.filters[0][1]==='A'?read.promise:Promise.resolve({data:[row('B')]}));r.render('A');await r.effects();r.render('B');await r.effects();read.resolve({data:[row('A')]});await flush();assert.equal(r.render().notifications[0].id,'B');
  const save=deferred();const w=harness(async call=>({data:[row(call.filters[0][1])]}),()=>save.promise);w.render('A');await w.effects();w.render().handleToggle();const pending=w.render().handleActionClick(row('A'));w.render('B');await w.effects();const writes=w.writes;save.resolve({confirmedIds:['A'],complete:true});await pending;assert.equal(w.writes,writes);assert.equal(w.render().notifications[0].id,'B');assert.equal(w.routes.length,0);assert.equal(w.render().actionPending,false);
});

test('unmounted reads and saves cannot update state, refresh or navigate',async()=>{
  const read=deferred();const r=harness(()=>read.promise);r.render();await r.effects();r.unmount();const count=r.writes;read.resolve({data:[row('late')]});await flush();assert.equal(r.writes,count);
  const save=deferred();const w=harness(async()=>({data:[row('a')]}),()=>save.promise);w.render();await w.effects();const pending=w.render().handleActionClick(row('a'));w.unmount();const writes=w.writes;save.resolve({confirmedIds:['a'],complete:true});await pending;assert.equal(w.writes,writes);assert.equal(w.queries.length,1);assert.equal(w.routes.length,0);
});

test('dropdown error and pending states render accessible alerts, retries, and disabled actions',()=>{
  function render(overrides){let index=0;const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n in overrides?[overrides[n],()=>{}]:state;}};const page={exports:{}};
    new Function('require','exports',compile(source))(name=>{
      if(name==='react')return hooks;if(name==='next/navigation')return{useRouter:()=>({push(){}})};if(name==='@/lib/supabase')return{supabase:{}};
      if(name==='@/lib/client-notification-inbox')return{changeClientNotifications(){}};if(name==='@/lib/job-links')return{normalizeJobLink:value=>value};
      if(name==='next/link'||name.endsWith('CategoryBadge')||name.endsWith('PriorityBadge'))return{__esModule:true,default:()=>null};return require(name);
    },page.exports);return renderToStaticMarkup(React.createElement(page.exports.default,{userId:'owner'}));}
  const failed=render({0:true,2:false,3:true});assert.match(failed,/role="alert"/);assert.match(failed,/>Retry</);assert.match(failed,/Unable to load notifications/);assert.doesNotMatch(failed,/No notifications yet|all caught up|Showing last/);
  const pending=render({0:true,1:[row('a')],2:false,5:true});assert.equal((pending.match(/disabled=""/g)||[]).length,3);
  const action=render({0:true,1:[row('a')],2:false,4:'Read changes could not be confirmed.'});assert.match(action,/role="alert"/);assert.match(action,/Reload notifications/);
});
