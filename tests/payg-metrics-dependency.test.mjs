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

test('PAYG metrics keeps newer refresh results and ignores responses after close',async()=>{
 const source=fs.readFileSync('app/admin/payg-metrics/page.tsx','utf8');const marker='export default function AdminPaygMetricsPage() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const formatCurrency'));const pending=[];let count=2;const db={from:()=>{const q={select:()=>q,eq:()=>q,gte:()=>q,lt:()=>q,not:()=>q,then:(resolve,reject)=>(pending.shift()||Promise.resolve({count,data:[],error:null})).then(resolve,reject)};return q}};const r=harness('return function component(){'+body+'return {metrics,loading,fetchMetrics};}',{supabase:db,setTimeout(){}});const old=deferred();pending.push(old.promise);r.render();await r.runEffects();let api=r.render();await api.fetchMetrics();old.resolve({count:99,data:[],error:null});await flush();api=r.render();assert.equal(api.metrics.totalPaygClients,2);assert.equal(api.loading,false);const closing=deferred();pending.push(closing.promise);const request=api.fetchMetrics();await flush();r.unmount();closing.resolve({count:100,data:[],error:null});await request;api=r.render();assert.equal(api.metrics.totalPaygClients,2);
});
