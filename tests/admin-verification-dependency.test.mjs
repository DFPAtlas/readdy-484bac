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

test('verification filters reject old responses, clear selection and ignore closed-screen reads',async()=>{const source=fs.readFileSync('app/admin/verify-guards/VerifyGuardsClient.tsx','utf8');const marker='export default function VerifyGuardsClient() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const openConfirmModal'));const pending=[],calls=[];const r=harness('return function component(){'+body+'return {guards,loading,fetchGuards,setFilter,setSelectedIds,selectedIds};}',{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},fetch:url=>{calls.push(url);return pending.shift()||Promise.resolve({ok:true,json:async()=>({data:[{id:'fresh'}]})})},process:{env:{}},setTimeout(){}});const late=deferred();pending.push(late.promise);let api=r.render();await r.runEffects();const old=api.fetchGuards;api.setSelectedIds(new Set(['old']));api.setFilter('approved');r.render();await r.runEffects();late.resolve({ok:true,json:async()=>({data:[{id:'stale'}]})});await flush();api=r.render();assert.equal(api.guards[0].id,'fresh');assert.equal(api.selectedIds.size,0);const count=calls.length;await old();assert.equal(calls.length,count);const closed=deferred();pending.push(closed.promise);const request=api.fetchGuards();await flush();r.unmount();closed.resolve({ok:true,json:async()=>({data:[{id:'closed'}]})});await request;assert.equal(r.render().guards[0].id,'fresh');});
