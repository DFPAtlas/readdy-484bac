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

test('client monitoring rejects previous clients, tabs and closed-screen responses', async () => {
 const source=fs.readFileSync('app/admin/client-monitoring/ClientMonitoringDetail.tsx','utf8');
 const marker='export default function ClientMonitoringDetail({ client, onClose }: DetailProps) {';
 const body=source.slice(source.indexOf(marker)+marker.length, source.indexOf('  const handleSaveNotes'));
 const requests=[];
 const supabase={from(table){const d=deferred();const request={table,...d};requests.push(request);const query={select(){return this},eq(){return this},or(){return this},order(){return this},limit(){return this},then(resolve,reject){return d.promise.then(resolve,reject)}};return query}};
 const r=harness('return function component({client}){'+body+'return {contacts,jobs,payments,loading,setActiveTab,toast};}',{supabase,setTimeout(){}});
 const client=id=>({id,user_id:'user-'+id,company_name:id,notes:''});
 r.render({client:client('a')});await r.runEffects();
 r.render({client:client('b')});await r.runEffects();
 assert.equal(requests.length,2);
 requests[1].resolve({data:[{id:'b-contact'}]});await flush();
 requests[0].resolve({data:[{id:'a-contact'}]});await flush();
 let api=r.render({client:client('b')});assert.equal(api.contacts[0].id,'b-contact');
 await r.runEffects();assert.equal(requests.length,2,'same client must not refetch');
 api.setActiveTab('jobs');r.render({client:client('b')});await r.runEffects();
 api=r.render({client:client('b')});api.setActiveTab('payments');r.render({client:client('b')});await r.runEffects();
 requests[2].resolve({data:[{id:'old-job'}]});await flush();
 api=r.render({client:client('b')});assert.equal(api.jobs.length,0);assert.equal(api.loading,true,'old tab must not clear current loading');
 requests[3].resolve({data:[{id:'b-payment'}]});await flush();
 api=r.render({client:client('b')});assert.equal(api.payments[0].id,'b-payment');assert.equal(api.loading,false);
 r.render({client:client('c')});await r.runEffects();
 api=r.render({client:client('c')});assert.equal(api.payments.length,0,'previous client data cleared');
 r.unmount();requests[4].resolve({data:[{id:'closed-payment'}]});await flush();
 assert.equal(r.render({client:client('c')}).payments.length,0);
});
