import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function harness(code,env){
 const slots=[],effects=[],pending=[];let cursor=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hooks={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useRef:v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useCallback:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect:(fn,deps)=>{const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}};
 const args={...hooks,...env};const component=new Function(...Object.keys(args),compile(code))(...Object.values(args));
 return {render(props){cursor=0;return component(props)},async runEffects(){pending.splice(0).forEach(fn=>fn());await flush()},unmount(){effects.forEach(e=>e?.cleanup?.())}};
}
function ticketHarness(path){
 const source=fs.readFileSync(path,'utf8');const marker=source.indexOf('export default function TicketDetailDrawer(');const start=source.indexOf(') {',marker)+3;const body=source.slice(start,source.indexOf('  const canReply =',start));
 const reads=[],channels=[],removed=[],readQueue=[],sendQueue=[];
 const db={from:()=>{let ticketId;const q={select:()=>q,eq:(key,value)=>{if(key==='ticket_id')ticketId=value;return q},order:()=>{reads.push(ticketId);return readQueue.shift()||Promise.resolve({data:[{id:'message-'+ticketId}]})},insert:()=>q,single:()=>sendQueue.shift()||Promise.resolve({data:{id:'saved'},error:null}),update:()=>q,then:resolve=>Promise.resolve({error:null}).then(resolve)};return q},channel:name=>{const c={name,on:(event,filter,fn)=>{c.notify=fn;return c},subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c.name),functions:{invoke:async()=>({error:null})}};
 const args=path.includes('/client/')?'ticket,clientId,onClose,onUpdated':'ticket,guardId,onClose,onUpdated';
 const r=harness('return function component({'+args+'}) {'+body+'return {messages,replyText,error,sending,setReplyText,handleSendReply};}',{supabase:db});
 return {r,reads,channels,removed,readQueue,sendQueue,props:id=>({ticket:{id,status:'open'},clientId:'client',guardId:'guard',onUpdated(){},onClose(){}})};
}
for(const role of ['client','guard']){
 test(role+' ticket switches discard old messages, preserve current drafts and clean subscriptions',async()=>{
  const h=ticketHarness(`app/${role}/support/TicketDetailDrawer.tsx`);const late=deferred();h.readQueue.push(late.promise);
  h.r.render(h.props('A'));await h.r.runEffects();h.r.render(h.props('B'));await h.r.runEffects();let api=h.r.render(h.props('B'));await h.r.runEffects();assert.equal(api.messages[0].id,'message-B');assert.deepEqual(h.removed,['ticket-A-messages']);
  late.resolve({data:[{id:'stale-A'}]});await flush();api=h.r.render(h.props('B'));await h.r.runEffects();assert.equal(api.messages[0].id,'message-B');
  api.setReplyText('reply to B');api=h.r.render(h.props('B'));const send=deferred();h.sendQueue.push(send.promise);const sent=api.handleSendReply();await flush();
  h.r.render(h.props('C'));await h.r.runEffects();api=h.r.render(h.props('C'));api.setReplyText('new C draft');api=h.r.render(h.props('C'));
  send.resolve({data:{id:'saved-B'},error:null});await sent;api=h.r.render(h.props('C'));await h.r.runEffects();assert.equal(api.replyText,'new C draft');assert.equal(api.sending,false);
  h.r.unmount();assert.deepEqual(h.removed,['ticket-A-messages','ticket-B-messages','ticket-C-messages']);
 });
}
test('history applies edited filters explicitly, clears the applied query and aborts requests on unmount',async()=>{
 const source=fs.readFileSync('app/client/job-history/page.tsx','utf8');const marker='export default function ClientJobHistoryClient() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const totalPages ='));
 const calls=[],responses=[];const clientData={company_name:'Client'};
 const r=harness('const EMPTY_HISTORY_FILTERS={searchQuery:"",statusFilter:"all",paymentFilter:"all",dateFrom:"",dateTo:"",guardFilter:""}; return function component(){'+body+'return {setSearchQuery,handleFilterChange,clearFilters,handlePageChange,currentPage,jobs,loadHistory};}',{useRouter:()=>({}),useClientGuard:()=>({allowed:true,userId:'user',clientData}),useRouteGuard:()=>({checking:false,blocked:false}),supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},fetch:(url,options)=>{calls.push({query:JSON.parse(options.body),signal:options.signal});return responses.shift()||Promise.resolve({ok:true,json:async()=>({jobs:[]})})},window:{scrollTo(){}}});
 let api=r.render();await r.runEffects();assert.equal(calls.length,1);
 api.setSearchQuery('edited');api=r.render();await r.runEffects();assert.equal(calls.length,1);
 api.handleFilterChange();api=r.render();await r.runEffects();assert.equal(calls.at(-1).query.search,'edited');
 api.clearFilters();api=r.render();await r.runEffects();assert.equal(calls.at(-1).query.search,undefined);
 api.handlePageChange(3);api=r.render();await r.runEffects();assert.equal(calls.at(-1).query.page,3);
 const late=deferred();responses.push(late.promise);const refresh=api.loadHistory(3,true);await flush();r.unmount();assert.equal(calls.at(-1).signal.aborted,true);late.resolve({ok:true,json:async()=>({jobs:[{id:'stale'}]})});await refresh;
});

for(const [path,name] of [['app/client/jobs/[id]/ReplacementStatusTracker.tsx','ReplacementStatusTracker'],['app/client/notifications/ReplacementNotificationsSection.tsx','ReplacementNotificationsSection']]){
 test(name+' discards superseded realtime results and cleans its subscription',async()=>{
  const source=fs.readFileSync(path,'utf8');const marker=source.indexOf('export default function '+name+'(');const start=source.indexOf(') {',marker)+3;const body=source.slice(start,source.indexOf('  if (loading) {',start));
  const queue=[],channels=[],removed=[];let reads=0;
  const db={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>{reads++;return queue.shift()||Promise.resolve({data:[{id:'fresh'}]})}};return q},channel:key=>{const c={key,on:(event,filter,fn)=>{c.notify=fn;return c},subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c.key)};
  const r=harness('return function component({jobId,clientId}){'+body+'return {requests,loading};}',{supabase:db});
  const first=deferred();queue.push(first.promise);const props={jobId:'job',clientId:'client'};r.render(props);await r.runEffects();channels[0].notify();await flush();
  let api=r.render(props);await r.runEffects();assert.equal(api.requests[0].id,'fresh');first.resolve({data:[{id:'stale'}]});await flush();api=r.render(props);await r.runEffects();assert.equal(api.requests[0].id,'fresh');
  const old=channels[0];r.render({...props,clientId:'other'});await r.runEffects();assert.equal(removed.length,1);const count=reads;old.notify();await flush();assert.equal(reads,count);
  r.unmount();assert.equal(removed.length,2);
 });
}
