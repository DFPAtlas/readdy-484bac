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

function submissionsHarness(){
 const source=fs.readFileSync('app/admin/contact-submissions/AdminSubmissionsClient.tsx','utf8');const marker='export default function AdminSubmissionsClient() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const handleExport ='));
 const reads=[],queue=[],channels=[],removed=[];
 const db={from:()=>{let head,fields,search;const q={select:(s,options)=>{fields=s;head=options?.head;return q},eq:()=>q,or:value=>{search=value;return q},order:()=>q,range:(from,to)=>{reads.push({search,from,to});return queue.shift()||Promise.resolve({data:[{id:search||'initial'}],count:1})},not:()=>Promise.resolve({data:[]}),then:resolve=>Promise.resolve({count:1,data:[]}).then(resolve)};return q},channel:name=>{const c={name,on:()=>c,subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c.name)};
 const r=harness('const PAGE_SIZE=20;return function component(){'+body+'return {submissions,loading,page,setSearch,goToPage,refresh};}',{supabase:db});return {r,reads,queue,channels,removed};
}
test('admin submissions loads once initially, resets search pagination and drops out-of-order pages',async()=>{
 const h=submissionsHarness();let api=h.r.render();await h.r.runEffects();assert.equal(h.reads.length,1);assert.equal(h.channels.length,1);
 api=h.r.render();const late=deferred();h.queue.push(late.promise);api.goToPage(3);await flush();api.setSearch('latest');api=h.r.render();await h.r.runEffects();api=h.r.render();assert.equal(h.reads.at(-1).from,0);assert.match(api.submissions[0].id,/latest/);assert.equal(api.page,0);late.resolve({data:[{id:'old-page'}],count:99});await flush();api=h.r.render();assert.match(api.submissions[0].id,/latest/);assert.equal(api.page,0);
 const count=h.reads.length;h.r.render();await h.r.runEffects();assert.equal(h.reads.length,count);assert.equal(h.channels.length,1);h.r.unmount();assert.equal(h.removed.length,1);
});
function siaHarness(){
 const source=fs.readFileSync('app/admin/sia-verifications/SIAVerificationsClient.tsx','utf8');const marker='export default function SIAVerificationsClient() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const handleRetriggerVerification'));
 const queue=[],calls=[],channels=[],removed=[];const db={functions:{invoke:(name,{body})=>{calls.push(body);return queue.shift()||Promise.resolve({data:body.action==='stats'?{stats:{totalPending:2}}:{data:[{guardId:'fresh'}],totalCount:1,stats:{totalPending:1}},error:null})}},channel:name=>{const c={name,on:(kind,options,fn)=>{c.notify=fn;return c},subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c)};
 const r=harness('const PAGE_SIZE=10;return function component(){'+body+'return {entries,stats,loading,fetchPage,fetchStats,setFilter};}',{supabase:db,setTimeout:()=>1,clearTimeout(){}});return {r,queue,calls,channels,removed};
}
test('SIA list and stats reject older responses without changing loading ownership',async()=>{
 const h=siaHarness(),old=deferred();h.queue.push(old.promise);let api=h.r.render();await h.r.runEffects();api=h.r.render();await api.fetchPage(2,'verified','','date');api=h.r.render();assert.equal(api.entries[0].guardId,'fresh');old.resolve({data:{data:[{guardId:'old'}],stats:{totalPending:99}},error:null});await flush();api=h.r.render();assert.equal(api.entries[0].guardId,'fresh');assert.equal(api.stats.totalPending,1);assert.equal(api.loading,false);
 const olderStats=deferred();h.queue.push(olderStats.promise);const statsRequest=api.fetchStats();await api.fetchPage(1,'all','','date');olderStats.resolve({data:{stats:{totalPending:98}},error:null});await statsRequest;api=h.r.render();assert.equal(api.stats.totalPending,1);
 const pending=deferred();h.queue.push(pending.promise);const request=api.fetchPage(3,'all','','date');h.r.unmount();pending.resolve({data:{data:[{guardId:'closed'}]},error:null});await request;api=h.r.render();assert.equal(api.entries[0].guardId,'fresh');assert.equal(h.removed.length,1);
});
