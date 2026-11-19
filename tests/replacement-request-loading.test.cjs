const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const flush = async () => { for(let n=0;n<30;n++) await Promise.resolve(); };
const row = id => ({id,job_id:'job',client_id:'client',reason:'guard_absent',urgency:'urgent',status:'searching',created_at:'2026-11-18T10:00:00Z',updated_at:'2026-11-18T10:00:00Z',jobs:{title:'Event shift'}});
const files = [
  {path:'app/client/notifications/ReplacementNotificationsSection.tsx',name:'ReplacementNotificationsSection',tracker:false},
  {path:'app/client/jobs/[id]/ReplacementStatusTracker.tsx',name:'ReplacementStatusTracker',tracker:true},
];
// Live app schema checked 19 Nov 2026. Validate embedded fields even when the
// replacement list is empty: PostgREST rejects invalid projections before rows.
const requestColumns = new Set('id client_id job_id assignment_id guard_id reason urgency required_arrival_time notes contact_phone status support_ticket_id created_at updated_at'.split(' '));
const jobColumns = new Set(['id','client_id','job_title','city']);
function validateProjection(fields) {
  const embed = fields.match(/jobs:job_id\(([^)]+)\)/);
  if(embed)for(const part of embed[1].split(',')) {
    const column=part.trim().split(':').at(-1);
    if(!jobColumns.has(column))return {message:'Unknown jobs column: '+column};
  }
  for(const field of fields.replace(/,?\s*jobs:job_id\([^)]+\)/,'').split(',')) {
    if(field.trim()!=='*'&&!requestColumns.has(field.trim()))return {message:'Unknown replacement column: '+field};
  }
  return null;
}
function harness(file,read=async()=>({data:[row('fresh')]})){
  const source=fs.readFileSync(file.path,'utf8'),marker=source.indexOf('export default function '+file.name+'('),start=source.indexOf(') {',marker)+3,body=source.slice(start,source.indexOf('  if (loading) {',start));
  const slots=[],effects=[],pending=[],queries=[],channels=[],removed=[];let cursor=0,writes=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,n)=>Object.is(value,b[n]));
  const hooks={useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},useEffect(fn,deps){const n=cursor++;if(!effects[n]||!same(effects[n].deps,deps))pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};});}};
  const db={from(table){const call={table,filters:[]};queries.push(call);const q={select(fields){call.fields=fields;return q;},returns(){return q;},eq(key,value){call.filters.push([key,value]);return q;},order(key,options){call.order=[key,options];return q;},then(resolve,reject){const error=validateProjection(call.fields);return Promise.resolve(error?{data:null,error}:read(call)).then(resolve,reject);}};return q;},channel(name){const channel={name,on(kind,filter,notify){channel.filter=filter;channel.notify=notify;return channel;},subscribe(){channels.push(channel);return channel;}};return channel;},removeChannel:channel=>removed.push(channel)};
  const env={...hooks,supabase:db};
  const component=new Function(...Object.keys(env),compile(`return function({clientId,jobId}){${body}\nreturn {requests,loading,loadError,retryLoad};}`))(...Object.values(env));
  let props={clientId:'client',jobId:'job'};
  return{queries,channels,removed,get writes(){return writes;},render(next=props){props=next;cursor=0;return component(props);},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}

test('replacement notifications map the deployed job title and render populated and missing-job records',async()=>{
  const file=files[0];
  const r=harness(file,async call=>{
    const storedJob={job_title:'UAT venue shift',city:'London'};
    const fields=call.fields.match(/jobs:job_id\(([^)]+)\)/)[1].split(',');
    const job=Object.fromEntries(fields.map(field=>{const [alias,column]=field.trim().split(':');return [alias,storedJob[column||alias]];}));
    return {data:[{...row('populated'),jobs:job,support_ticket_id:'test-ticket'}]};
  });
  r.render();await r.effects();const api=r.render();
  assert.equal(api.loadError,false);assert.deepEqual(api.requests[0].jobs,{title:'UAT venue shift'});
  function render(requests){
    let index=0;const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;return n===0?[requests,()=>{}]:n===1?[false,()=>{}]:n===2?['populated',()=>{}]:n===3?[false,()=>{}]:state;}};
    const component={exports:{}};
    new Function('require','exports',compile(fs.readFileSync(file.path,'utf8')))(name=>name==='react'?hooks:name==='@/lib/supabase'?{supabase:{}}:name==='next/link'?{__esModule:true,default:props=>React.createElement('a',props,props.children)}:require(name),component.exports);
    return renderToStaticMarkup(React.createElement(component.exports.default,{clientId:'client'}));
  }
  const html=render(api.requests);assert.match(html,/UAT venue shift/);assert.match(html,/Searching/);assert.match(html,/guard absent/);assert.match(html,/View Linked Support Ticket/);assert.match(html,/href="\/client\/jobs\/detail\?id=job"/);
  assert.doesNotMatch(html,/Unable to load replacement requests|Unknown Job/);
  const missing=render([{...row('missing'),jobs:null}]);assert.match(missing,/Unknown Job/);assert.doesNotMatch(missing,/Unable to load replacement requests/);
  r.unmount();
});

for(const file of files){
  test(file.name+' rejects returned/thrown/malformed loads and recovers on retry',async()=>{
    for(const failure of [{data:null,error:{message:'private backend detail'}},{data:null,error:null},{data:{unexpected:true}},Error('offline')]){
      let reads=0;const r=harness(file,async()=>{if(reads++===0){if(failure instanceof Error)throw failure;return failure;}return{data:[row('retry')]};});r.render();await r.effects();let api=r.render();assert.equal(api.loadError,true);assert.equal(api.loading,false);assert.deepEqual(api.requests,[]);api.retryLoad();assert.equal(r.render().loading,true);await flush();api=r.render();assert.equal(api.loadError,false);assert.equal(api.requests[0].id,'retry');
    }
  });

  test(file.name+' preserves owner/job scopes and distinguishes successful empty results from missing context',async()=>{
    const r=harness(file,async()=>({data:[]}));r.render();await r.effects();const api=r.render();assert.equal(api.loadError,false);assert.equal(api.loading,false);assert.deepEqual(api.requests,[]);
    assert.equal(r.queries[0].table,'replacement_requests');assert.deepEqual(r.queries[0].filters,file.tracker?[['job_id','job'],['client_id','client']]:[['client_id','client']]);assert.deepEqual(r.queries[0].order,['created_at',{ascending:false}]);
    assert.equal(validateProjection(r.queries[0].fields),null);
    if(!file.tracker){assert.match(r.queries[0].fields,/jobs:job_id\(title:job_title\)/);assert.doesNotMatch(r.queries[0].fields,/\*|contact_phone|notes|guard_id/);}
    assert.deepEqual(r.channels[0].filter,{event:'*',schema:'app',table:'replacement_requests',filter:file.tracker?'job_id=eq.job':'client_id=eq.client'});
    const absent=harness(file);absent.render({clientId:'',jobId:'job'});await absent.effects();assert.equal(absent.queries.length,0);assert.equal(absent.channels.length,0);assert.equal(absent.render().loadError,true);
    if(file.tracker){const missingJob=harness(file);missingJob.render({clientId:'client',jobId:''});await missingJob.effects();assert.equal(missingJob.queries.length,0);assert.equal(missingJob.render().loadError,true);}
  });

  test(file.name+' realtime failures stay visible and retry replaces the previously loaded snapshot',async()=>{
    let reads=0;const r=harness(file,async()=>++reads===1?{data:[row('previous')]}:reads===2?{data:null,error:{message:'private detail'}}:{data:[row('recovered')]});r.render();await r.effects();r.channels[0].notify();await flush();let api=r.render();assert.equal(api.loadError,true);assert.equal(api.requests[0].id,'previous');api.retryLoad();await flush();api=r.render();assert.equal(api.loadError,false);assert.equal(api.requests[0].id,'recovered');
  });

  test(file.name+' ignores both late successes and late failures after newer realtime results',async()=>{
    for(const failure of [false,true]){
      const late=deferred();let reads=0;const r=harness(file,()=>reads++===0?late.promise:Promise.resolve({data:[row('latest')]}));r.render();await r.effects();r.channels[0].notify();await flush();const writes=r.writes;if(failure)late.reject(Error('late failure'));else late.resolve({data:[row('old')]});await flush();assert.equal(r.writes,writes);assert.equal(r.render().requests[0].id,'latest');assert.equal(r.render().loadError,false);
    }
  });

  test(file.name+' rejects prior identities and retired retries, and cleans up after unmount',async()=>{
    const late=deferred();let reads=0;const r=harness(file,()=>reads++===0?late.promise:Promise.resolve({data:[row('new-client')]}));const old=r.render();await r.effects();const oldChannel=r.channels[0];r.render({clientId:'other',jobId:file.tracker?'other-job':'job'});await r.effects();late.resolve({data:[row('old-client')]});await flush();assert.equal(r.render().requests[0].id,'new-client');const count=r.queries.length;old.retryLoad();oldChannel.notify();await flush();assert.equal(r.queries.length,count);assert.equal(r.removed.length,1);
    if(file.tracker){
      const oldJob=deferred();let jobReads=0;const changing=harness(file,()=>jobReads++===0?oldJob.promise:Promise.resolve({data:[row('new-job')]}));const oldRetry=changing.render({clientId:'client',jobId:'first-job'});await changing.effects();changing.render({clientId:'client',jobId:'second-job'});await changing.effects();oldJob.resolve({data:[row('old-job')]});await flush();assert.equal(changing.render().requests[0].id,'new-job');const before=changing.queries.length;oldRetry.retryLoad();await flush();assert.equal(changing.queries.length,before);changing.unmount();
    }
    const pending=deferred();const closing=harness(file,()=>pending.promise);const retry=closing.render();await closing.effects();closing.unmount();const writes=closing.writes,requests=closing.queries.length;retry.retryLoad();closing.channels[0].notify();pending.resolve({data:[row('late')]});await flush();assert.equal(closing.writes,writes);assert.equal(closing.queries.length,requests);assert.equal(closing.removed.length,1);
  });

  test(file.name+' renders an accessible error and Retry without false empty/status summaries',()=>{
    const source=fs.readFileSync(file.path,'utf8');
    function render(failed,rows=[]){let index=0;const hooks={...React,useState(initial){const state=React.useState(initial),n=index++;if(n===0)return[rows,()=>{}];if(n===1)return[false,()=>{}];if(n===(file.tracker?2:3))return[failed,()=>{}];return state;}};const component={exports:{}};
      new Function('require','exports',compile(source))(name=>{if(name==='react')return hooks;if(name==='@/lib/supabase')return{supabase:{}};if(name==='next/link')return{__esModule:true,default:()=>null};return require(name);},component.exports);
      return renderToStaticMarkup(React.createElement(component.exports.default,{clientId:'client',jobId:'job'}));}
    for(const rows of [[],[row('previous')]]){const html=render(true,rows);assert.match(html,/role="alert"/);assert.match(html,/Retry loading replacement requests/);assert.doesNotMatch(html,/No active replacement requests|No replacement matches ready yet|1 searching|Event shift/);assert.doesNotMatch(html,/private backend detail/);}
    const empty=render(false);assert.doesNotMatch(empty,/role="alert"/);if(file.tracker)assert.equal(empty,'');else assert.match(empty,/No active replacement requests/);
  });
}
