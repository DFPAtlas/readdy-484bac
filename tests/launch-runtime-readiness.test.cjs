const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load } = require('./helpers/enterprise-module.cjs');
const source = fs.readFileSync('supabase/functions/launch-readiness/index.ts', 'utf8');
const path = 'supabase/functions/launch-readiness/index.ts';
const healthy = extra => ({status:'healthy',timestamp:new Date().toISOString(),checks:{database:{status:'healthy'},stripe:{status:'healthy'},email:{status:'configured'},environment:{status:'healthy'}},...extra});
function harness({ payload=healthy(), http=200, networkError=false, invalidJson=false, role='super_admin', active=true, signoffs=[], auditFailure=null }={}) {
 let handler; const writes=[],requests=[],configs=[];
 const admin={id:'admin-id',role,is_active:active,full_name:'Fixture Admin',email:'admin@example.invalid'};
 const db={auth:{getUser:async token=>({data:{user:token==='fixture-token'?{id:'admin-user'}:null},error:null})},schema:()=>db,
  rpc:async()=>({data:[{schema_name:'app',table_name:'jobs',rls_enabled:true}],error:null}),
  from:table=>{
   const result={data:table==='admin_users'?(active?admin:null):table==='launch_readiness_check_signoffs'?signoffs:[],count:1,error:table==='admin_activity_log'&&auditFailure==='error'?{message:'fixture audit failure'}:null};
   const q={select:()=>q,eq:()=>q,in:()=>q,limit:()=>q,order:()=>q,
    maybeSingle:async()=>table==='launch_readiness_decisions'?{data:{id:'decision-id'},error:null}:result,
    insert:row=>{writes.push({table,row});return q;},upsert:row=>{writes.push({table,row});return q;},
    then:(resolve,reject)=>(table==='admin_activity_log'&&auditFailure==='throw'?Promise.reject(Error('private audit failure')):Promise.resolve(result)).then(resolve,reject)};
   return q;
  }};
 const env={SUPABASE_URL:'https://fixture.supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_ANON_KEY:'fixture-anon',GOOGLE_GEOCODING_API_KEY:'fixture-geocode',STRIPE_SECRET_KEY:'sk_live_fixture'};
 load(path,{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:(url,key,options)=>{configs.push({url,key,options});return db;}}},
  {Deno:{serve:fn=>{handler=fn;},env:{get:key=>env[key]}},fetch:async(url,options)=>{
   requests.push({url,options});
   if(url.endsWith('/system-health')){if(networkError)throw Error('private network secret');return new Response(invalidJson?'not json':JSON.stringify(payload),{status:http});}
   if(url.endsWith('/geocode-address'))return Response.json({latitude:51,longitude:0});
   if(url==='https://quickguard.uk'){const r=new Response('QuickGuard');Object.defineProperty(r,'url',{value:url});return r;}
   return new Response('',{status:410});
  }});
 return {writes,requests,configs,call:(body={},token='fixture-token')=>handler(new Request('https://fixture.invalid/launch-readiness',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
async function runtime(options){const h=harness(options);const response=await h.call({action:'run'});assert.equal(response.status,200);const data=await response.json();return {h,check:data.checks.find(c=>c.id==='edge_functions'),data};}
test('a degraded runtime cannot pass or claim that all Edge Functions are healthy',async()=>{
 const {check}=await runtime({payload:healthy({status:'degraded'})});
 assert.equal(check.status,'not_verified');assert.match(check.notes,/degraded/);
 assert.doesNotMatch(check.notes,/Core runtime healthy/);assert.equal(check.label,'Core runtime health probe');
});
test('forged, empty or omitted browser results cannot approve GO against current unverified server checks',async()=>{
 for(const decision of ['GO','CONDITIONAL GO']) for(const results of [undefined,[],[{id:'edge_functions',category:'critical',status:'pass'}]]){
  const h=harness({payload:healthy({status:'degraded'})});const response=await h.call({action:'save_decision',decision,confirmed:true,results});
  assert.equal(response.status,400);assert.equal(h.writes.length,0);
  assert.ok(h.requests.some(r=>r.url.endsWith('/system-health')));
 }
});
test('only fresh consistent complete runtime evidence passes the narrowly labelled probe',async()=>{
 const {check,h}=await runtime();assert.equal(check.status,'pass');assert.match(check.notes,/separate/);
 const request=h.requests.find(r=>r.url.endsWith('/system-health'));assert.ok(request.options.signal instanceof AbortSignal);
 assert.equal(h.writes.length,0);
});
test('missing, stale, future, malformed and contradictory runtime evidence never passes',async()=>{
 const absent={...healthy().checks};delete absent.stripe;
 for(const payload of [null,[],{},healthy({timestamp:null}),healthy({timestamp:'invalid'}),healthy({timestamp:new Date(Date.now()-301000).toISOString()}),healthy({timestamp:new Date(Date.now()+120000).toISOString()}),healthy({status:'unknown'}),healthy({status:['healthy']}),healthy({checks:null}),healthy({checks:absent}),healthy({checks:{...healthy().checks,stripe:{status:['healthy']}}}),healthy({checks:{...healthy().checks,database:{status:'unhealthy'}}}),healthy({checks:{...healthy().checks,stripe:{status:'access_denied'}}}),healthy({checks:{...healthy().checks,email:{status:'not_configured'}}})]){
  assert.notEqual((await runtime({payload})).check.status,'pass');
 }
});
test('HTTP failure, invalid JSON, network failure and critical runtime cannot be reported healthy',async()=>{
 for(const options of [{http:401},{http:403},{http:429},{http:503},{invalidJson:true},{networkError:true},{payload:healthy({status:'critical'})}]){
  const {check}=await runtime(options);assert.notEqual(check.status,'pass');assert.doesNotMatch(check.notes,/private network secret/);
 }
});
test('persisting a GO uses current server results and refuses warnings or failed re-evaluation',async()=>{
 const start=source.indexOf('    if (action === "save_decision")');
 const end=source.indexOf('    return new Response(JSON.stringify({ error: "Unknown action" })',start);
 const code=ts.transpileModule('async function run(){'+source.slice(start,end)+'}\nreturn run();',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 for(const decision of ['GO','CONDITIONAL GO']) for(const state of ['pass','not_verified','warning','throw']){
  const authoritative=[{id:'edge_functions',category:'critical',status:state}],saved=[];let reads=0;
  const q={insert:row=>{saved.push(row);return q;},select:()=>q,maybeSingle:async()=>({data:{id:'saved'},error:null}),catch:()=>Promise.resolve()};
  const deps={action:'save_decision',body:{decision,confirmed:true,results:[{id:'forged',category:'critical',status:'pass'}]},isSuperAdmin:true,admin:{role:'super_admin',email:'admin@example.invalid'},user:{id:'admin-user'},corsHeaders:{},req:new Request('https://fixture.invalid'),supabaseQ:{from:()=>q},
   evaluateAutoChecks:async()=>{reads++;if(state==='throw')throw Error('read unavailable');return authoritative;},manualChecks:async()=>[],applySignoffs:async checks=>checks,recordActivity:async()=>{}};
  const run=new Function(...Object.keys(deps),code);
  if(state==='throw'){await assert.rejects(run(...Object.values(deps)),/read unavailable/);assert.equal(saved.length,0);continue;}
  const response=await run(...Object.values(deps));assert.equal(reads,1);
  if(state==='pass'||(state==='warning'&&decision==='CONDITIONAL GO')){assert.equal(response.status,200);assert.deepEqual(saved[0].results,authoritative);}
  else{assert.equal(response.status,400);assert.equal(saved.length,0);}
 }
});
test('existing role/confirmation gates, NO-GO recording and deployed redirect/auth safeguards are retained',async()=>{
 for(const options of [{role:'finance_admin'},{active:false}]){const h=harness(options);assert.equal((await h.call({action:'save_decision',decision:'GO',confirmed:true})).status,403);assert.equal(h.writes.length,0);}
 const h=harness();for(const confirmed of [false,'false',1,{},null])assert.equal((await h.call({action:'save_decision',decision:'GO',confirmed})).status,400);assert.equal(h.writes.length,0);
 const no=harness();assert.equal((await no.call({action:'save_decision',decision:'NO-GO',confirmed:true,results:[]})).status,200);
 assert.equal(no.writes[0].row.decision,'NO-GO');
 const r=await runtime();assert.ok(r.data.checks.some(c=>c.id==='www_apex_redirect'&&c.status==='not_verified'&&c.evidenceRequired));
 const auth=r.h.configs.find(c=>c.key==='fixture-anon');assert.equal(auth.options.global.headers.Authorization,'Bearer fixture-token');
 const redirect=harness();const response=await redirect.call({action:'sign_off_check',check_id:'www_apex_redirect',status:'pass',evidence:'looks good'});assert.equal(response.status,400);assert.match((await response.json()).error,/Evidence required/);assert.equal(redirect.writes.length,0);
});
test('a PostgREST thenable needs no catch method and an audit failure cannot turn a saved decision into a retry',async()=>{
 for(const auditFailure of [null,'error','throw']){
  const h=harness({auditFailure});const response=await h.call({action:'save_decision',decision:'NO-GO',confirmed:true,results:[]});
  assert.equal(response.status,200);assert.equal((await response.json()).success,true);
  assert.equal(h.writes.filter(w=>w.table==='launch_readiness_decisions').length,1);
  assert.equal(h.writes.filter(w=>w.table==='admin_activity_log').length,1);
 }
});
