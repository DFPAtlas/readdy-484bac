const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function monitor({authorized=true,admin=true,heartbeat=null,counts={},queryError=false}={}) {
 const queries=[];
 const db={auth:{getUser:async()=>({data:{user:authorized?{id:'admin-user'}:null},error:null})},from(table){
  queries.push(table);
  const query={};
  for(const key of ['select','eq','in','gte','lte','lt','order','limit'])query[key]=()=>query;
  query.maybeSingle=async()=>table==='admin_users'?{data:admin?{id:'admin',is_active:true}:null,error:null}:{data:heartbeat,error:queryError?{message:'private error'}:null};
  query.then=resolve=>Promise.resolve({count:counts[table]??0,error:queryError?{message:'private error'}:null}).then(resolve);
  // No write methods exist: tests fail if a diagnostic attempts a mutation.
  return query;
 }};
 const source=fs.readFileSync('supabase/functions/_shared/agent-health-check.ts','utf8').replace(/^import .*;\n/gm,'');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 new Function('module','exports','createClient','Deno',compiled)(module,module.exports,()=>db,{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':'service-key'}});
 return {queries,call:(body={agent:'all'},token='admin-token',method='POST')=>module.exports.handleAgentHealth(new Request('https://example.test/functions/v1/agent-health-check',{method,headers:token?{Authorization:'Bearer '+token,'Content-Type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
test('monitor denies missing/invalid sessions and inactive admins before operational reads',async()=>{
 for(const [options,token,status] of [[{},'',401],[{authorized:false},'bad',401],[{admin:false},'user',403]]) {
  const m=monitor(options);assert.equal((await m.call({},token)).status,status);
  assert.deepEqual(m.queries,options.admin===false?['admin_users']:[]);
 }
});
test('all three diagnostics return the admin page result shape and missing heartbeats stay amber',async()=>{
 const m=monitor();const response=await m.call();assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.results.length,3);assert.equal(data.health,'degraded');
 for(const result of data.results){assert.equal(result.status,'warn');assert.ok(result.checks.some(c=>c.key==='worker_heartbeat'&&c.status==='warn'));}
});
test('fresh healthy heartbeat permits healthy data checks; stale heartbeat cannot pass',async()=>{
 for(const [age,status] of [[0,'ok'],[7200000,'warn']]) {
  const m=monitor({heartbeat:{health:'healthy',created_at:new Date(Date.now()-age).toISOString()}});
  const data=await(await m.call({agent:'jobs'})).json();assert.equal(data.results[0].status,status);
 }
});
test('financial issues and read errors are failures, not zero-count healthy results',async()=>{
 for(const options of [{counts:{financial_operations:1}},{queryError:true}]){
  const m=monitor(options);const data=await(await m.call({agent:'payments'})).json();assert.equal(data.status,'fail');
  assert.ok(!JSON.stringify(data).includes('private error'));
 }
});
test('trusted automation can read diagnostics and invalid agent/site input is rejected',async()=>{
 const m=monitor({admin:false});assert.equal((await m.call({},'service-key')).status,200);
 assert.ok(!m.queries.includes('admin_users'));
 assert.equal((await monitor().call({agent:'__proto__'})).status,400);
 assert.equal((await monitor().call({site:'another-site'})).status,400);
 assert.equal((await monitor().call({},'admin-token','GET')).status,405);
});
test('snapshot storage and default-schema compatibility views remain service-only',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create schema app;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema app to anon,authenticated,service_role;');
  const migration=fs.readFileSync('supabase/migrations/20261005151552_agent_monitor_storage.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec("set role service_role;insert into public.agent_state_snapshots(agent_id,site,health,state) values('payments','quickguard.uk','healthy','{\"private\":true}');insert into public.agent_registry(agent_id,name) values('payments','Payment worker');");
  assert.equal((await db.query("select count(*)::int n from app.agent_state_snapshots")).rows[0].n,1);
  for(const role of ['anon','authenticated']){
   await db.exec('reset role;set role '+role);
   for(const schema of ['app','public'])for(const table of ['agent_registry','agent_state_snapshots'])await assert.rejects(db.query(`select * from ${schema}.${table}`));
   await assert.rejects(db.query("insert into public.agent_state_snapshots(agent_id) values('forged')"));
  }
 }finally{await db.close();}
});
