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

function jobHarness(){
 const source=fs.readFileSync('app/guard/jobs/[id]/GuardJobDetailClient.tsx','utf8');const marker='export default function GuardJobDetailClient({ jobId }: { jobId: string }) {';const start=source.indexOf(marker)+marker.length;const end=source.indexOf('  useEffect(() => {\n    const handleScroll',start);const body=source.slice(start,end);
 const auth=[],payments=[],details=[],redirects=[],reads=[],history=[],historyCalls=[],failures=new Map();const router={push:path=>redirects.push(path)};
 const db={auth:{getUser:()=>auth.shift()||Promise.resolve({data:{user:{id:'user'}}})},functions:{invoke:(name,{body})=>details.shift()||Promise.resolve({data:{job:{id:body.jobId,client_id:'client'}},error:null})},from:table=>{let job,selection;const q={select:fields=>{selection=fields;return q},eq:(key,value)=>{if(key==='job_id')job=value;return q},maybeSingle:()=>{reads.push({table,job});if(failures.has(table))return Promise.resolve({data:null,error:failures.get(table)});if(table==='guards')return Promise.resolve({data:{id:'guard',full_name:'Guard',verification_status:'approved'}});if(table==='clients')return Promise.resolve({data:{user_id:'client-user'}});if(table==='job_assignments'&&selection.includes('payment_amount'))return payments.shift()||Promise.resolve({data:null});return Promise.resolve({data:job==='A'?{id:table+'-A'}:null})}};return q}};
 const r=harness('return function component({jobId}){'+body+'return {job,loading,jobError,hasApplied,isAssigned,hasInvite,isSaved,clientUserId,flowData,loadingFlow,load};}',{useRouter:()=>router,supabase:db,loadGuardHistoryJobs:()=>{historyCalls.push(true);return history.shift()||Promise.resolve([])},setTimeout(){}});
 return {r,auth,payments,details,redirects,reads,history,historyCalls,failures};
}
test('job switches reset relationship flags and discard late authentication',async()=>{
 const h=jobHarness();h.r.render({jobId:'A'});await h.r.runEffects();let api=h.r.render({jobId:'A'});assert.equal(api.hasApplied,true);assert.equal(api.isAssigned,true);assert.equal(api.hasInvite,true);assert.equal(api.isSaved,true);
 h.r.render({jobId:'B'});await h.r.runEffects();api=h.r.render({jobId:'B'});for(const key of ['hasApplied','isAssigned','hasInvite','isSaved'])assert.equal(api[key],false,key);assert.equal(api.job.id,'B');
 const late=deferred();h.auth.push(late.promise);const old=api.load();await flush();h.r.render({jobId:'C'});await h.r.runEffects();late.resolve({data:{user:null}});await old;api=h.r.render({jobId:'C'});assert.equal(api.job.id,'C');assert.deepEqual(h.redirects,[]);
});
test('payment results from an old job cannot replace the current flow or clear its spinner',async()=>{
 const h=jobHarness();const old=deferred(),current=deferred();h.payments.push(old.promise,current.promise);
 h.r.render({jobId:'A'});await h.r.runEffects();h.r.render({jobId:'B'});await h.r.runEffects();let api=h.r.render({jobId:'B'});assert.equal(api.loadingFlow,true);
 old.resolve({data:null});await flush();api=h.r.render({jobId:'B'});assert.equal(api.loadingFlow,true);assert.equal(api.flowData,null);
 h.r.unmount();current.resolve({data:{id:'assignment-B'}});await flush();assert.equal(h.historyCalls.length,0);assert.equal(h.reads.some(q=>q.table==='job_completion_requests'),false);
});
test('failed detail requests expose a retry and an old retry cannot overwrite another job',async()=>{
 const h=jobHarness();h.details.push(Promise.resolve({data:null,error:new Error('network')}));h.r.render({jobId:'A'});await h.r.runEffects();let api=h.r.render({jobId:'A'});assert.equal(api.loading,false);assert.match(api.jobError,/Unable to load/);
 const late=deferred();h.details.push(late.promise);const retry=api.load();await flush();h.r.render({jobId:'B'});await h.r.runEffects();late.resolve({data:{job:{id:'A'}}});await retry;api=h.r.render({jobId:'B'});assert.equal(api.job.id,'B');assert.equal(api.jobError,null);assert.equal(api.loading,false);
});

test('relationship lookup failure shows a retry instead of pretending there is no application',async()=>{
 const h=jobHarness();h.failures.set('job_applications',new Error('database unavailable'));h.r.render({jobId:'B'});await h.r.runEffects();const api=h.r.render({jobId:'B'});assert.equal(api.job,null);assert.equal(api.loading,false);assert.match(api.jobError,/Unable to load/);
});
