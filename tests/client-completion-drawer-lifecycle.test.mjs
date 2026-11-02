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

function completionHarness(){
 const source=fs.readFileSync('app/client/dashboard/CompletionApprovalPanel.tsx','utf8');const marker='export default function CompletionApprovalPanel({ clientId, jobId, onReviewed }: Props) {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  if (loading)'));
 const responses=[],sessions=[],calls=[];
 const r=harness('return function component({clientId,jobId}){'+body+'return {requests,loading,error,loadRequests,selectedRequest,setSelectedRequest};}',{supabase:{auth:{getSession:()=>sessions.shift()||Promise.resolve({data:{session:{access_token:'token'}}})}},fetch:(url,options)=>{calls.push(options);return responses.shift()||Promise.resolve({ok:true,json:async()=>({requests:[]})})},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test'}}});
 return {r,responses,sessions,calls};
}
const response=requests=>({ok:true,json:async()=>({requests})});
test('completion selection aborts old requests, rejects old reload callbacks and clears the selected review',async()=>{
 const h=completionHarness();const late=deferred();h.responses.push(late.promise);let props={clientId:'client',jobId:'A'};let api=h.r.render(props);await h.r.runEffects();const old=api.loadRequests;api.setSelectedRequest({id:'old'});
 props={...props,jobId:'B'};h.responses.push(Promise.resolve(response([{id:'fresh',job_id:'B',status:'pending'},{id:'other',job_id:'A',status:'pending'}])));h.r.render(props);await h.r.runEffects();api=h.r.render(props);assert.deepEqual(api.requests.map(x=>x.id),['fresh']);assert.equal(api.selectedRequest,null);assert.equal(h.calls[0].signal.aborted,true);
 late.resolve(response([{id:'late',job_id:'A',status:'pending'}]));await flush();api=h.r.render(props);assert.equal(api.requests[0].id,'fresh');const count=h.calls.length;await old();assert.equal(h.calls.length,count);h.r.render({...props});await h.r.runEffects();assert.equal(h.calls.length,count);
});
test('completion retry keeps newest result and preserves genuine transport errors',async()=>{
 const h=completionHarness();const props={clientId:'client'};h.responses.push(Promise.resolve({ok:false,json:async()=>({error:'Unavailable'})}));h.r.render(props);await h.r.runEffects();let api=h.r.render(props);assert.equal(api.error,'Unavailable');assert.equal(api.loading,false);
 const late=deferred();h.responses.push(late.promise);const old=api.loadRequests();await flush();h.responses.push(Promise.resolve(response([{id:'new',status:'pending'}])));await api.loadRequests();late.resolve(response([{id:'old',status:'pending'}]));await old;api=h.r.render(props);assert.equal(api.requests[0].id,'new');assert.equal(api.error,'');assert.equal(api.loading,false);
});
test('completion cleanup prevents a late session lookup from starting a fetch',async()=>{
 const h=completionHarness();const session=deferred();h.sessions.push(session.promise);h.r.render({clientId:'client'});await h.r.runEffects();h.r.unmount();session.resolve({data:{session:{access_token:'token'}}});await flush();assert.equal(h.calls.length,0);
});
function drawerHarness(){
 const source=fs.readFileSync('app/client/jobs/JobDetailDrawer.tsx','utf8');const marker='export default function JobDetailDrawer({ job, clientId, onClose }: JobDetailDrawerProps) {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const formatDate ='));
 const assignments=[],calls=[],failures=new Map();const db={schema:()=>db,from:table=>{let job,client;const q={select:()=>q,eq:(k,v)=>{if(k==='job_id')job=v;if(k==='client_id')client=v;return q},order:()=>q,limit:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>{calls.push({table,job,client});return Promise.resolve(failures.has(table)?{data:null,error:failures.get(table)}:{data:table==='job_cancellations'?{id:'cancel-'+job}:[{id:table+'-'+job,guard_id:'guard-'+client}]}).then(resolve,reject)}};return q}};
 const r=harness('return function component({job,clientId}){'+body+'return {assignments,transactions,guardReviews,cancellation,refundRequests,loading,detailsError,loadDetails};}',{supabase:db,useRouter:()=>({}),loadClientJobAssignments:()=>assignments.shift()||Promise.resolve([{id:'assigned'}])});return {r,assignments,calls,failures};
}
test('drawer cancels old job details, reloads changed client and ignores a closed drawer response',async()=>{
 const h=drawerHarness(),late=deferred();h.assignments.push(late.promise);let props={job:{id:'A'},clientId:'one'};let api=h.r.render(props);await h.r.runEffects();const old=api.loadDetails;
 props={job:{id:'B'},clientId:'one'};h.r.render(props);await h.r.runEffects();late.resolve([{id:'old-A'}]);await flush();api=h.r.render(props);assert.equal(api.transactions[0].id,'transactions-B');assert.equal(api.assignments[0].id,'assigned');const count=h.calls.length;await old();assert.equal(h.calls.length,count);
 props={job:{id:'B'},clientId:'two'};h.r.render(props);await h.r.runEffects();api=h.r.render(props);assert.ok(api.guardReviews['guard-two']);assert.equal(api.guardReviews['guard-one'],undefined);
 const closing=deferred();h.assignments.push(closing.promise);const request=api.loadDetails();await flush();h.r.unmount();closing.resolve([{id:'closed'}]);await request;api=h.r.render(props);assert.deepEqual(api.assignments,[]);
});
test('drawer reports returned query errors and can retry without a refresh loop',async()=>{
 const h=drawerHarness();const props={job:{id:'A'},clientId:'client'};h.failures.set('transactions',new Error('unavailable'));h.r.render(props);await h.r.runEffects();let api=h.r.render(props);assert.equal(api.detailsError,true);assert.equal(api.loading,false);assert.deepEqual(api.transactions,[]);
 h.failures.clear();await api.loadDetails();api=h.r.render(props);assert.equal(api.detailsError,false);assert.equal(api.transactions[0].id,'transactions-A');const count=h.calls.length;h.r.render({...props,job:{id:'A'}});await h.r.runEffects();assert.equal(h.calls.length,count);
});
