const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load } = require('./helpers/enterprise-module.cjs');
function harness({counts={},errors=[],throws=[],cleanupEmpty=false,cleanupFailure=false,cleanupOverride,stripeCode=200,stripeThrow=false,env={}}={}){
 let handler;const reads=[],clients=[],requests=[],rpcs=[];
 const environment={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-secret',STRIPE_SECRET_KEY:'fixture-stripe-secret',RESEND_API_KEY:'fixture-resend-secret',...env};
 const createClient=(url,key,options)=>{
  const schema=options?.db?.schema||'public';clients.push({schema,key});
  return {rpc:(name,args)=>{
   rpcs.push({schema,name,args});const q={abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return q;},then:(resolve,reject)=>{
    if(throws.includes('maintenance'))return Promise.reject(Error('private query detail')).then(resolve,reject);
    const at=new Date().toISOString();const cleanup={status:cleanupEmpty||cleanupFailure?'degraded':'healthy',recent_completed_tables:cleanupEmpty?0:6,required_tables:6,
     last_run:cleanupEmpty?null:{table:'fixture_table',at,rows_removed:0},last_failure:cleanupFailure?{table:'fixture_table',at,error:'PRIVATE CLEANUP ERROR'}:null,
     logs:[{error_message:'PRIVATE CLEANUP ERROR',id:'PRIVATE LOG ID'}],...cleanupOverride};
    return Promise.resolve({data:{cron_jobs:[{command:'PRIVATE CRON COMMAND'}],cleanup},error:errors.includes('maintenance')?{message:'private query detail'}:null}).then(resolve,reject);
   }};return q;
  },from:table=>{
   const q={select:()=>q,eq:()=>q,gte:()=>q,order:()=>q,limit:()=>q,abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return q;},
    then:(resolve,reject)=>{
     const id=table;reads.push({schema,table,id});
     if(throws.includes(id))return Promise.reject(Error('private query detail')).then(resolve,reject);
     const error=errors.includes(id)?{message:'private query detail'}:null;
     const data=[];
     return Promise.resolve({data,count:Object.hasOwn(counts,table)?counts[table]:0,error}).then(resolve,reject);
    }};return q;
  }};
 };
 load('supabase/functions/system-health/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient}},
  {Deno:{serve:fn=>{handler=fn;},env:{get:key=>environment[key]}},fetch:async(url,options)=>{requests.push({url,options});if(stripeThrow)throw Error('private Stripe error');return new Response('private Stripe detail',{status:stripeCode});}});
 return {reads,clients,requests,rpcs,call:async(method='GET')=>{const response=await handler(new Request('https://fixture.invalid/system-health',{method}));return {response,data:method==='HEAD'||response.status===204?null:await response.json()};}};
}
test('Resend-only configuration is recognised and a fully confirmed public read returns healthy without exposing secrets',async()=>{
 const h=harness();const {response,data}=await h.call();assert.equal(response.status,200);
 assert.equal(data.checks.email.provider,'Resend API');assert.equal(data.checks.email.status,'configured');assert.equal(data.checks.environment.status,'healthy');assert.equal(data.status,'healthy');
 assert.equal(data.metrics.failed_emails_24h,0);assert.equal(data.cleanup.last_run.rows_removed,0);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(JSON.stringify(data),/fixture-.*secret|private Stripe detail|PRIVATE CLEANUP ERROR|PRIVATE LOG ID|PRIVATE CRON COMMAND/);
 assert.ok(h.reads.length>0);assert.ok(h.reads.every(r=>r.schema==='app'));assert.deepEqual(h.clients.map(c=>c.schema),['app']);assert.deepEqual(h.rpcs,[{schema:'app',name:'get_admin_maintenance_snapshot',args:{p_offset:0,p_limit:1}}]);
});
test('failed or unconfirmed count reads stay null, never fabricated zeros or partial payment totals',async()=>{
 for(const table of ['email_send_log','subscription_payments','transactions','admin_alerts'])for(const mode of ['error','throw','null','invalid']){
  const counts={email_send_log:2,subscription_payments:4,transactions:6,admin_alerts:1};
  const h=harness({counts:{...counts,...(mode==='null'?{[table]:null}:mode==='invalid'?{[table]:-1}:{})},errors:mode==='error'?[table]:[],throws:mode==='throw'?[table]:[]});
  const {data}=await h.call();const field=table==='email_send_log'?'failed_emails_24h':table==='admin_alerts'?'unread_admin_alerts':'failed_payments_24h';
  assert.equal(data.metrics[field],null);assert.equal(data.checks.metrics.status,'unknown');assert.notEqual(data.status,'healthy');assert.doesNotMatch(JSON.stringify(data),/private query detail/);
 }
});
test('known failure counts degrade health while unread alerts remain informational',async()=>{
 const h=harness({counts:{email_send_log:1,transactions:2,subscription_payments:3}});const {data}=await h.call();assert.equal(data.status,'degraded');assert.equal(data.metrics.failed_payments_24h,5);
 assert.equal((await harness({counts:{admin_alerts:2}}).call()).data.status,'healthy');
});
test('missing cleanup evidence and maintenance RPC failures are unknown, while recorded failure stays degraded',async()=>{
 for(const options of [{cleanupEmpty:true},{errors:['maintenance']},{throws:['maintenance']}]){
  const {data}=await harness(options).call();assert.equal(data.cleanup.status,'unknown');assert.notEqual(data.status,'healthy');assert.doesNotMatch(JSON.stringify(data),/private query detail/);
 }
 const {data}=await harness({cleanupFailure:true}).call();assert.equal(data.cleanup.status,'degraded');assert.equal(data.status,'degraded');assert.equal(data.cleanup.last_failure.table,'fixture_table');
});
test('Stripe scope/credential/rate failures remain distinct from outages and cannot erase a critical database failure',async()=>{
 for(const [stripeCode,status] of [[401,'invalid_credentials'],[403,'access_denied'],[429,'rate_limited'],[503,'unhealthy']]){
  const h=harness({stripeCode});const {data}=await h.call();assert.equal(data.checks.stripe.status,status);assert.equal(data.status,'degraded');assert.ok(h.requests[0].options.signal instanceof AbortSignal);
 }
 const {response,data}=await harness({throws:['jobs'],stripeThrow:true}).call();assert.equal(data.status,'critical');assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(data),/private query detail|private Stripe error/);
});
test('missing configuration, SMTP completeness and method/preflight contracts stay explicit and read-only',async()=>{
 for(const missing of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){const h=harness({env:{[missing]:undefined}});const {response,data}=await h.call();assert.equal(response.status,503);assert.equal(data.status,'critical');assert.equal(h.reads.length,0);assert.equal(h.requests.length,0);}
 const smtp=await harness({env:{RESEND_API_KEY:undefined,SMTP_HOST:'smtp.fixture.invalid',SMTP_USER:'fixture',SMTP_PASS:'fixture'}}).call();assert.equal(smtp.data.checks.email.provider,'SMTP');
 assert.equal((await harness({env:{RESEND_API_KEY:undefined,SMTP_USER:'fixture',SMTP_PASS:'fixture'}}).call()).data.checks.email.status,'not_configured');
 for(const method of ['GET','POST'])assert.equal((await harness().call(method)).response.status,200);
 for(const [method,status] of [['OPTIONS',204],['DELETE',405]]){const h=harness();assert.equal((await h.call(method)).response.status,status);assert.equal(h.reads.length,0);assert.equal(h.requests.length,0);}
 assert.equal((await harness().call('HEAD')).response.status,200);
});
test('the public response is compatible with the repaired launch runtime assessor',async()=>{
 const text=fs.readFileSync('supabase/functions/launch-readiness/index.ts','utf8');
 const start=text.indexOf('function isRecord('),end=text.indexOf('Deno.serve',start);
 const compiled=ts.transpileModule(text.slice(start,end)+'\nreturn assessRuntimeHealth;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const assess=new Function(compiled)();
 for(const options of [{},{stripeCode:403},{errors:['email_send_log']},{cleanupEmpty:true}]){
  const {response,data}=await harness(options).call();const result=await assess(async()=>Response.json(data,{status:response.status}));
  assert.equal(result.status,Object.keys(options).length?'not_verified':'pass');
 }
});

test('stale, partial, malformed and contradictory maintenance evidence never reports a healthy cleanup',async()=>{
 for(const cleanupOverride of [
  {recent_completed_tables:5},{required_tables:5},{recent_completed_tables:'6'},
  {last_run:{table:'fixture_table',at:new Date(Date.now()-49*3600000).toISOString(),rows_removed:0}},
  {last_run:{table:'fixture_table',at:new Date(Date.now()+3600000).toISOString(),rows_removed:0}},
  {last_run:{table:'fixture_table',at:new Date().toISOString(),rows_removed:-1}},
  {last_run:null},{last_run:{}},{last_failure:{}},{status:'unknown'},
 ]){const {data}=await harness({cleanupOverride}).call();assert.equal(data.cleanup.status,'unknown');assert.notEqual(data.status,'healthy');}
 const {data}=await harness({cleanupOverride:{status:'degraded'}}).call();assert.equal(data.cleanup.status,'degraded');
});
