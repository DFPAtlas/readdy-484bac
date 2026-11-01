import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
function verificationHarness({getUser,status=async()=>({data:{verification_status:'pending'},error:null})}){
 const source=fs.readFileSync('app/guard/verification-pending/page.tsx','utf8');
 const body=source.slice(source.indexOf('export default function VerificationPendingPage() {')+'export default function VerificationPendingPage() {'.length,source.indexOf('  if (authLoading || !allowed) {'));
 const effects=[],timers=new Map(),writes=[],routes=[];let next=0;
 const q={select:()=>q,eq:()=>q,maybeSingle:status};
 const db={auth:{getUser},from:()=>q};
 const keys=['useRouter','useGuardGuard','useState','useRef','useEffect','useCallback','supabase','POLL_INTERVAL','setInterval','clearInterval','clearBadStoredRedirects'];
 const values=[()=>({push:path=>routes.push(path)}),()=>({loading:false,allowed:true}),initial=>[initial,value=>writes.push(value)],initial=>({current:initial}),fn=>effects.push(fn),fn=>fn,db,30,(fn,ms)=>{timers.set(++next,{fn,ms});return next},id=>timers.delete(id),()=>{}];
 const fn=new Function(...keys,compile('return (()=>{'+body+'return {handleManualCheck};})()'));
 const api=fn(...values);return {api,effects,timers,writes,routes};
}
test('late auth completion after verification unmount cannot write state or create polling timers',async()=>{
 const auth=deferred();const h=verificationHarness({getUser:()=>auth.promise});
 const cleanup=h.effects[0]();assert.equal(h.timers.size,1);cleanup();const writes=h.writes.length;
 auth.resolve({data:{user:{id:'guard',email:'guard@example.invalid'}}});await flush();
 assert.equal(h.timers.size,0);assert.equal(h.writes.length,writes);assert.equal(h.routes.length,0);
});
test('late verification response and manual refresh cannot restart timers after cleanup',async()=>{
 const response=deferred();const h=verificationHarness({getUser:async()=>({data:{user:{id:'guard'}}}),status:()=>response.promise});
 const cleanup=h.effects[0]();await flush();cleanup();const writes=h.writes.length;
 response.resolve({data:{verification_status:'approved'}});await flush();await h.api.handleManualCheck();
 assert.equal(h.timers.size,0);assert.equal(h.writes.length,writes);assert.deepEqual(h.routes,[]);
});
test('pending verification keeps one poll/countdown pair; terminal status stops it',async()=>{
 let status='pending';const h=verificationHarness({getUser:async()=>({data:{user:{id:'guard'}}}),status:async()=>({data:{verification_status:status}})});
 const cleanup=h.effects[0]();await flush();assert.equal(h.timers.size,3);
 await h.api.handleManualCheck();assert.equal(h.timers.size,3);
 status='approved';await h.api.handleManualCheck();assert.deepEqual(h.routes,['/guard/dashboard']);assert.equal(h.timers.size,1);
 cleanup();assert.equal(h.timers.size,0);
});
function safetyEffect(){
 const source=fs.readFileSync('app/client/trust-safety/TrustSafetyClient.tsx','utf8');
 const start=source.indexOf('    let cancelled = false;');const end=source.indexOf('  }, [jobs]);',start);
 assert.ok(start>=0&&end>start);
 return new Function('jobs','supabase','setAssignments','setLoadingAssignments',compile(source.slice(start,end)));
}
test('safety assignments reload for a same-size replacement job set, discard late results, and clear empty sets',async()=>{
 const effect=safetyEffect();const writes=[],loading=[],queries=[];const old=deferred();
 const db={from:()=>{const q={select:()=>q,in:(key,ids)=>{queries.push(ids);return ids.includes('old')?old.promise:Promise.resolve({data:[{id:'assignment-new',job_id:'new',guard_id:null}]})}};return q}};
 const first=effect([{id:'old'}],db,v=>writes.push(v),v=>loading.push(v));first();
 const second=effect([{id:'new'}],db,v=>writes.push(v),v=>loading.push(v));await flush();assert.ok(writes.at(-1).new);
 old.resolve({data:[{id:'assignment-old',job_id:'old',guard_id:null}]});await flush();assert.ok(writes.at(-1).new);assert.equal(writes.length,1);
 second();effect([],db,v=>writes.push(v),v=>loading.push(v));assert.deepEqual(writes.at(-1),{});assert.equal(loading.at(-1),false);
 assert.deepEqual(queries,[['old'],['new']]);
});

function paymentHarness(){
 const source=fs.readFileSync('app/client/jobs/[id]/payment/PaymentClient.tsx','utf8');
 const marker='export default function PaymentClient({ jobId }: { jobId: string }) {';
 const prelude=source.slice(source.indexOf('function getPaymentStatus'),source.indexOf(marker));
 const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const calculateCosts ='));
 const slots=[],effectSlots=[],pending=[],timers=new Map(),routes=[],userRequests=[],fetchRequests=[];let cursor=0;let timerId=0;let authCalls=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const state=initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]};
 const ref=initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]};
 const callback=(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn};
 const effect=(fn,deps)=>{const i=cursor++;if(!effectSlots[i]||!same(effectSlots[i].deps,deps))pending.push(()=>{effectSlots[i]?.cleanup?.();effectSlots[i]={deps,cleanup:fn()}})};
 const db={auth:{getUser:()=>{authCalls++;return userRequests.shift()||Promise.resolve({data:{user:{id:'user'}}})},getSession:async()=>({data:{session:{access_token:'test'}}})},from:table=>{
  let jobId='';const q={select:()=>q,eq:(name,value)=>{if(name==='id')jobId=value;return q},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:table==='clients'?{id:'client'}:{id:jobId,payment_status:'processing'}}),then:resolve=>Promise.resolve({data:[]}).then(resolve)};return q;
 }};
 const router={push:path=>routes.push(path)};
 const args={useRouter:()=>router,useSearchParams:()=>new URLSearchParams(),useClientGuard:()=>({loading:false,allowed:true}),useRouteGuard:()=>({checking:false,blocked:false}),useState:state,useRef:ref,useCallback:callback,useEffect:effect,supabase:db,loadClientJobAssignments:async()=>[],fetch:()=>fetchRequests.shift()||Promise.resolve({ok:true,json:async()=>({clientTotalCharge:100})}),setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearInterval:id=>timers.delete(id)};
 const component=new Function(...Object.keys(args),compile(prelude+'\nreturn function component({jobId}: {jobId: string}) {'+body+'\nreturn {job,loading,loadPaymentData,loadFeeBreakdown,feeBreakdown};}'))(...Object.values(args));
 return {userRequests,fetchRequests,timers,routes,get authCalls(){return authCalls},render(jobId){cursor=0;return component({jobId})},async effects(){pending.splice(0).forEach(fn=>fn());await flush()},unmount(){effectSlots.forEach(slot=>slot?.cleanup?.())}};
}
test('payment refresh ignores a superseded job request and prevents overlapping polls',async()=>{
 const h=paymentHarness();const oldAuth=deferred();h.userRequests.push(oldAuth.promise);
 h.render('old');await h.effects();assert.equal(h.authCalls,1);
 h.render('new');await h.effects();let api=h.render('new');await h.effects();assert.equal(api.job.id,'new');assert.equal(h.timers.size,1);
 oldAuth.resolve({data:{user:{id:'old-user'}}});await flush();api=h.render('new');await h.effects();assert.equal(api.job.id,'new');
 const slow=deferred();h.userRequests.push(slow.promise);const poll=[...h.timers.values()][0].fn;const before=h.authCalls;poll();poll();await flush();assert.equal(h.authCalls,before+1);
 h.unmount();slow.resolve({data:{user:{id:'late'}}});await flush();assert.equal(h.timers.size,0);assert.deepEqual(h.routes,[]);
});


test('manual booking-total retry cannot overwrite a replacement job total',async()=>{
 const h=paymentHarness();h.render('old');await h.effects();let api=h.render('old');await h.effects();
 const response=deferred();h.fetchRequests.push(response.promise);const retry=api.loadFeeBreakdown('old');await flush();
 h.render('new');await h.effects();api=h.render('new');await h.effects();assert.equal(api.job.id,'new');assert.equal(api.feeBreakdown.clientTotalCharge,100);
 response.resolve({ok:true,json:async()=>({clientTotalCharge:999})});await retry;
 api=h.render('new');await h.effects();assert.equal(api.feeBreakdown.clientTotalCharge,100);h.unmount();
});
