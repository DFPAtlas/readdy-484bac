const {test}=require('node:test');const assert=require('node:assert/strict');
const {hooksHarness,nodes,content,flush}=require('./helpers/guard-ui-fixture.cjs');
const names=['admin_registration_audit','email_queue','email_send_log','notifications','processed_stripe_events','rate_limit_events'];
const id='33333333-3333-4333-8333-333333333333',key='quickguard:admin-cleanup-request';
function preview(){return{status:'previewed',request_id:id,expires_at:new Date(Date.now()+300000).toISOString(),inventory:{sampled_at:new Date().toISOString(),targets:names.map((table_name,i)=>({table_name,target_relation:'public.'+table_name,relation_type:'table',retention_days:[180,90,90,180,365,7][i],total_rows:2,eligible_rows:1}))}};}
function receipt(){return{status:'completed',request_id:id,total_removed:6,completed_at:new Date().toISOString(),results:names.map((table_name,i)=>({table_name,rows_removed:1,retention_days:90,cleanup_log_id:'a0000000-0000-4000-8000-00000000000'+i}))};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{resolve,reject,promise};}
class CleanupResponseError extends Error{constructor(code){super('Unconfirmed');this.code=code;}}
function fixture(storage=new Map()){
 const f={storage,actions:[],preview:preview(),receipt:receipt(),queues:{},refreshes:0,refreshError:false,storageBlocked:false};
 f.h=hooksHarness('components/admin/AdminCleanupControl.tsx',{'@/lib/adminManualCleanup':{
  CleanupResponseError,requestAdminCleanup:async(action,requestId,confirmed)=>{f.actions.push({action,requestId,confirmed});if(f.queues[action]?.length){const q=f.queues[action].shift();return q.promise;}return action==='preview'?f.preview:action==='execute'?f.receipt:f.receipt;}
 }},{window:{sessionStorage:{getItem:k=>{if(f.storageBlocked)throw Error('Blocked');return storage.get(k)||null;},setItem:(k,v)=>{if(f.storageBlocked)throw Error('Blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)}}});
 f.render=()=>f.h.render({onCompleted:async()=>{f.refreshes++;if(f.refreshError)throw Error('Private refresh failure');}});
 f.mount=async()=>{f.render();await f.h.effects();};
 return f;
}
function button(f,text){return nodes(f.render()).find(n=>n.type==='button'&&content(n)===text);}
function checkbox(f){return nodes(f.render()).find(n=>n.type==='input'&&n.props.type==='checkbox');}
async function ready(f){await f.mount();await button(f,'Review cleanup').props.onClick();}
test('actual control previews without executing and requires the explicit permanent-deletion checkbox even for zero eligible records',async()=>{
 const f=fixture();f.preview.inventory.targets.forEach(t=>{t.eligible_rows=0;});await ready(f);
 assert.deepEqual(f.actions.map(x=>x.action),['preview']);assert.ok(nodes(f.render()).some(n=>n.props.role==='dialog'));assert.equal(button(f,'Run confirmed cleanup').props.disabled,true);
 await button(f,'Run confirmed cleanup').props.onClick();assert.equal(f.actions.length,1);assert.match(content(f.render()),/0 records eligible/);assert.match(content(f.render()),/permanently deleted/);
 checkbox(f).props.onChange({target:{checked:true}});f.receipt.total_removed=0;f.receipt.results.forEach(r=>{r.rows_removed=0;});await button(f,'Run confirmed cleanup').props.onClick();await flush();assert.match(content(f.render()),/All six routines completed. 0 records removed/);assert.equal(f.refreshes,1);f.h.unmount();
});
test('double-clicks submit a confirmed request once and a subsequent monitoring refresh failure cannot erase its completion',async()=>{
 const f=fixture();await ready(f);checkbox(f).props.onChange({target:{checked:true}});const wait=deferred();f.queues.execute=[wait];const submit=button(f,'Run confirmed cleanup').props.onClick;const a=submit();await submit();assert.equal(f.actions.filter(a=>a.action==='execute').length,1);assert.equal(button(f,'Close').props.disabled,true);
 f.refreshError=true;wait.resolve(f.receipt);await a;await flush();assert.match(content(f.render()),/All six routines completed. 6 records removed/);assert.match(content(f.render()),/Cleanup completed. Refresh the inventory/);assert.equal(f.storage.has(key),false);f.h.unmount();
});
test('a lost response keeps the request reference and Check Result reads its receipt without issuing another execution',async()=>{
 const f=fixture();await ready(f);checkbox(f).props.onChange({target:{checked:true}});const wait=deferred();f.queues.execute=[wait];const run=button(f,'Run confirmed cleanup').props.onClick();wait.reject(Error('Network reply lost'));await run;
 assert.match(content(f.render()),/outcome is unconfirmed/);assert.equal(f.storage.get(key),id);assert.ok(button(f,'Check saved result'));assert.doesNotMatch(content(f.render()),/All six routines completed|6 failed/);
 await button(f,'Check saved result').props.onClick();await flush();assert.deepEqual(f.actions.map(x=>x.action),['preview','execute','status']);assert.match(content(f.render()),/All six routines completed/);f.h.unmount();
});
test('a reloaded saved request is checked first and never automatically executed, while another-admin 404 clears only the local reference',async()=>{
 const f=fixture(new Map([[key,id]]));await f.mount();assert.equal(f.actions.length,0);assert.ok(button(f,'Check saved cleanup'));await button(f,'Check saved cleanup').props.onClick();await flush();assert.deepEqual(f.actions.map(x=>x.action),['status']);f.h.unmount();
 const g=fixture(new Map([[key,id]]));await g.mount();const wait=deferred();g.queues.status=[wait];const check=button(g,'Check saved cleanup').props.onClick();wait.reject(new CleanupResponseError('NOT_FOUND'));await check;assert.equal(g.storage.has(key),false);assert.ok(button(g,'Review again'));assert.equal(g.actions.filter(x=>x.action==='execute').length,0);g.h.unmount();
});
test('server-side preview changes require a fresh review and confirmation rather than an automatic retry',async()=>{
 const f=fixture();await ready(f);checkbox(f).props.onChange({target:{checked:true}});const wait=deferred();f.queues.execute=[wait];const run=button(f,'Run confirmed cleanup').props.onClick();wait.reject(new CleanupResponseError('PREVIEW_CHANGED'));await run;assert.match(content(f.render()),/Eligible records changed/);assert.equal(f.storage.has(key),false);assert.equal(f.actions.length,2);
 await button(f,'Review again').props.onClick();assert.equal(button(f,'Run confirmed cleanup').props.disabled,true);assert.equal(f.actions.length,3);f.h.unmount();
});
test('unmount after submission retains recovery information without late state updates or a false completion',async()=>{
 const f=fixture();await ready(f);checkbox(f).props.onChange({target:{checked:true}});const wait=deferred();f.queues.execute=[wait];const run=button(f,'Run confirmed cleanup').props.onClick();f.h.unmount();const writes=f.h.writes;wait.resolve(f.receipt);await run;await flush();assert.equal(f.h.writes,writes);assert.equal(f.refreshes,0);assert.equal(f.storage.get(key),id);
});
test('saved expiry permits a new preview, invalid local references do not block review, and unavailable browser storage does not drop the in-memory request',async()=>{
 const f=fixture(new Map([[key,id]]));await f.mount();const wait=deferred();f.queues.status=[wait];const read=button(f,'Check saved cleanup').props.onClick();wait.resolve({status:'preview_expired',request_id:id});await read;assert.ok(button(f,'Review again'));assert.equal(f.storage.has(key),false);f.h.unmount();
 const g=fixture(new Map([[key,'------------------------------------']]));await g.mount();assert.ok(button(g,'Review cleanup'));assert.equal(g.actions.length,0);g.h.unmount();
 const h=fixture();h.storageBlocked=true;await ready(h);assert.ok(button(h,'Run confirmed cleanup'));assert.match(content(h.render()),new RegExp(id));assert.equal(h.storage.has(key),false);h.h.unmount();
});
