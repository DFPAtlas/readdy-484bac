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

test('admin payments rejects stale refreshes and responses after unmount',async()=>{const source=fs.readFileSync('app/admin/payments/page.tsx','utf8');const marker='export default function AdminPaymentsPage() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const getStatusStyle'));const pending=[];const db={from:table=>{const q={select:()=>q,order:()=>q,limit:()=>q,not:()=>q,in:()=>q,then:(resolve,reject)=>(table==='transactions'&&pending.length?pending.shift():Promise.resolve({data:table==='transactions'?[{id:'new',amount:1,created_at:'2026-01-01'}]:[]})).then(resolve,reject)};return q}};const r=harness('return function component(){'+body+'return {payments,loading,fetchPayments};}',{supabase:db,paymentAmounts:()=>({refunded:0,remaining:1}),setTimeout(){}});const old=deferred();pending.push(old.promise);r.render();await r.runEffects();let api=r.render();await api.fetchPayments();old.resolve({data:[{id:'old'}]});await flush();api=r.render();assert.equal(api.payments[0].id,'new');assert.equal(api.loading,false);const closing=deferred();pending.push(closing.promise);const request=api.fetchPayments();await flush();r.unmount();closing.resolve({data:[{id:'closed'}]});await request;api=r.render();assert.equal(api.payments[0].id,'new');});
