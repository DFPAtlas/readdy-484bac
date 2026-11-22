const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hooksHarness,nodes,content,flush}=require('./helpers/guard-ui-fixture.cjs');
function response(agent='payments',status='ok') {
 return {data:{site:'quickguard.uk',status,health:status==='ok'?'healthy':status==='warn'?'degraded':'unhealthy',checked_at:new Date().toISOString(),
  results:[{agent,label:agent,status,summary:'Confirmed '+agent+' result',checks:[{key:'worker_heartbeat',label:'Worker heartbeat',status,detail:'Current '+agent+' evidence'}]}]},error:null};
}
function setup(invoke){const calls=[];const h=hooksHarness('app/admin/agents/page.tsx',{'@/lib/supabase':{supabase:{functions:{invoke:async(name,options)=>{calls.push({name,options});return invoke(options.body.agent);}}}}});
 const tree=()=>h.render();const button=(i=0)=>nodes(tree()).filter(n=>n.type==='button')[i];
 return {h,calls,tree,button};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('failed retest clears prior healthy evidence immediately and offers retry after failure',async()=>{
 const next=deferred();let count=0;const f=setup(()=>++count===1?response():next.promise);f.tree();await f.h.effects();
 await f.button().props.onClick();assert.ok(content(f.tree()).includes('Current payments evidence'));
 const waiting=f.button().props.onClick();await flush();assert.ok(!content(f.tree()).includes('Current payments evidence'));
 next.resolve({data:null,error:new Error('Monitor unavailable')});await waiting;
 assert.ok(!nodes(f.tree()).some(n=>n.props.title==='Healthy'));assert.ok(content(f.tree()).includes('Retry'));
});
test('malformed, stale, mismatched and contradictory monitor replies never appear healthy',async()=>{
 const mutations=[
  r=>{r.data.results[0].agent='sia';},r=>{r.data.results[0].checks=[];},r=>{r.data.results[0].checks[0].status='unexpected';},
  r=>{r.data.results[0].checks[0].status='fail';},r=>{r.data.status='fail';},r=>{r.data.health='unhealthy';},
  r=>{r.data.checked_at='not-a-time';},r=>{r.data.checked_at=new Date(Date.now()-3600000).toISOString();},
  r=>{r.data.checked_at=new Date(Date.now()+3600000).toISOString();},r=>{r.data.site='other.example';},
  r=>{r.data.results.push(r.data.results[0]);},r=>{r.data.results[0].checks.push(r.data.results[0].checks[0]);},r=>{r.data.error='Read failed';},
 ];
 for(const mutate of mutations){const r=response();mutate(r);const f=setup(()=>r);f.tree();await f.h.effects();await f.button().props.onClick();const tree=f.tree();
  assert.ok(!nodes(tree).some(n=>n.props.title==='Healthy'));assert.ok(nodes(tree).some(n=>n.props.role==='alert'));
 }
});
test('rapid clicks cannot overlap the same check; different cards retain independent results',async()=>{
 const waiting=deferred();const f=setup(agent=>agent==='payments'?waiting.promise:response(agent,'warn'));f.tree();await f.h.effects();
 const click=f.button().props.onClick;const first=click();const second=click();const simultaneous=f.calls.length;
 await f.button(1).props.onClick();assert.ok(content(f.tree()).includes('Confirmed sia result'));
 waiting.resolve(response());await Promise.all([first,second]);assert.equal(simultaneous,1);assert.ok(content(f.tree()).includes('Confirmed payments result'));assert.ok(content(f.tree()).includes('Confirmed sia result'));
});
test('responses after unmount cannot update any state',async()=>{
 const waiting=deferred();const f=setup(()=>waiting.promise);f.tree();await f.h.effects();const request=f.button().props.onClick();
 f.h.unmount();const writes=f.h.writes;waiting.resolve(response());await request;assert.equal(f.h.writes,writes);
});
