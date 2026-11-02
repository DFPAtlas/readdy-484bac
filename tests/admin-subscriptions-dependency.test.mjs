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

test('subscriptions load once, reset filtered pages and reject stale or closed-screen responses',async()=>{
 const source=fs.readFileSync('app/admin/subscription-management/page.tsx','utf8');
 const marker='function SubscriptionManagementInner() {';
 const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  useEffect(() => {\n    if (toast)'));
 const requests=[];const sessions=[];
 const r=harness('return function component(){'+body+'return {subscriptions,loading,error,page,setPage,setStatusFilter,fetchData};}',{useSearchParams:()=>({get:()=>null}),PAGE_SIZE:25,process:{env:{}},supabase:{auth:{getSession:()=>sessions.shift()||Promise.resolve({data:{session:{access_token:'test'}}})}},fetch:(url,options)=>{const d=deferred();requests.push({...d,body:JSON.parse(options.body)});return d.promise}});
 const answer=(i,id)=>requests[i].resolve({ok:true,json:async()=>({subscriptions:[{id}],page:requests[i].body.page,totalCount:1})});
 let api=r.render();await r.runEffects();assert.equal(requests.length,1);answer(0,'initial');await flush();
 api=r.render();await r.runEffects();assert.equal(requests.length,1);
 api.setPage(3);r.render();await r.runEffects();assert.equal(requests[1].body.page,3);
 api=r.render();api.setStatusFilter('active');r.render();await r.runEffects();r.render();await r.runEffects();
 assert.equal(requests.length,3);assert.equal(requests[2].body.page,1);assert.equal(requests[2].body.status,'active');
 answer(2,'filtered');await flush();answer(1,'old-page');await flush();api=r.render();assert.equal(api.subscriptions[0].id,'filtered');assert.equal(api.page,1);
 const first=api.fetchData();await flush();const second=api.fetchData();await flush();answer(4,'newest');await second;answer(3,'older');await first;
 api=r.render();assert.equal(api.subscriptions[0].id,'newest');
 const lateSession=deferred();sessions.push(lateSession.promise);const closed=api.fetchData();await flush();r.unmount();lateSession.resolve({data:{session:{access_token:'test'}}});await closed;
 assert.equal(requests.length,5,'unmounted auth lookup must not start a request');
 assert.equal(r.render().subscriptions[0].id,'newest');
});
