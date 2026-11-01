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

function callbackHarness({exchange,params='?code=one&next=/client/dashboard'}){
 const source=fs.readFileSync('app/auth/callback/page.tsx','utf8');
 const helper=source.slice(source.indexOf('  const extractNames ='),source.indexOf('function CallbackContent()'));
 const marker='function CallbackContent() {';
 const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('\n  return ('));
 const timers=new Map(),routes=[],calls={exchange:0,existing:0,verified:0};let timerId=0;
 const router={push:path=>routes.push(path)};
 const user={id:'client-user',email:'test@example.test',user_metadata:{role:'client'}};
 const q={select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:user.id}})};
 const env={useSearchParams:()=>new URLSearchParams(params),useRouter:()=>router,supabase:{from:()=>q,auth:{exchangeCodeForSession:async()=>{calls.exchange++;return exchange(user)},getSession:async()=>{calls.existing++;return {data:{session:{user}}}},getUser:async()=>{calls.verified++;return {data:{user}}}}},window:{location:{search:params,hash:'',pathname:'/auth/callback'},history:{replaceState(){}}},sessionStorage:{getItem:()=>null,removeItem(){}},setTimeout:(fn)=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),sanitizeRedirectPath:path=>path,console:{error(){}}};
 const r=harness(helper+'return function component(){'+body+'return {status,message};}',env);
 return {r,timers,routes,calls};
}

test('callback exchanges incoming code once through rerenders and preserves verified redirect',async()=>{
 const wait=deferred();const {r,timers,routes,calls}=callbackHarness({exchange:()=>wait.promise});
 r.render();await r.runEffects();r.render();await r.runEffects();assert.equal(calls.exchange,1);
 wait.resolve({data:{session:{user:{id:'client-user'}}}});await flush();r.render();await r.runEffects();
 assert.equal(calls.exchange,1);assert.equal(calls.verified,1);assert.equal(calls.existing,0);assert.equal(r.render().status,'success');
 assert.equal(timers.size,1);for(const fn of timers.values())await fn();assert.deepEqual(routes,['/client/dashboard']);
});

test('failed incoming code cannot fall back to a saved account',async()=>{
 const {r,calls,routes}=callbackHarness({exchange:async()=>({data:{session:null},error:{message:'invalid code'}})});
 r.render();await r.runEffects();assert.equal(r.render().status,'error');assert.equal(calls.existing,0);assert.equal(calls.verified,0);assert.deepEqual(routes,[]);
});
