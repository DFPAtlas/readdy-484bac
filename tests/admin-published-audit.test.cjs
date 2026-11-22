const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./helpers/enterprise-module.cjs');
const {hooksHarness,nodes,content}=require('./helpers/guard-ui-fixture.cjs');
const snapshot={tables:[{schema_name:'app',table_name:'fixture',rls_enabled:true,public_access:false}],policies:[{schema_name:'app',table_name:'fixture',policy_count:1}],indexes:[{schema_name:'app',table_name:'fixture',index_count:1}]};

test('infrastructure catalog snapshot is invoker/service-only and distinguishes RLS from anonymous grants',async()=>{
  const db=new PGlite();try{
    await db.exec(`create schema app;create role anon;create role authenticated;create role service_role;
      create table app.protected(id int primary key,private_value text);alter table app.protected enable row level security;
      create policy owner_only on app.protected using(false);
      create table app.closed(id int);create table app.public_fixture(id int);
      grant usage on schema app to anon,authenticated,service_role;grant select on app.public_fixture to anon;
      insert into app.closed values(123456789);`);
    const name=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_admin_infrastructure_snapshot.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
    for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select app.get_admin_infrastructure_snapshot()'),/permission denied/);await db.exec('reset role');}
    await db.exec('set role service_role');const result=(await db.query('select app.get_admin_infrastructure_snapshot() value')).rows[0].value;
    assert.equal(result.tables.filter(t=>t.schema_name==='app').length,3);
    assert.equal(result.tables.find(t=>t.table_name==='closed').public_access,false);
    assert.equal(result.tables.find(t=>t.table_name==='public_fixture').public_access,true);
    assert.equal(result.policies.find(t=>t.table_name==='protected').policy_count,1);
    assert.equal(result.indexes.find(t=>t.table_name==='protected').index_count,1);
    assert.doesNotMatch(JSON.stringify(result),/123456789|private_value/);
  }finally{await db.close();}
});

function endpoint({aal='aal2',role='super_admin',active=true,user=true,failure=null,value=snapshot,writeError=false}={}){
  let handler;const rpcCalls=[],writes=[];
  function client(url,key,options){const db={schema(){return db;},auth:{getUser:async()=>({data:{user:user?{id:'admin'}:null}})},
    storage:{listBuckets:async()=>({data:[],error:failure==='buckets'?{message:'PRIVATE'}:null})},
    rpc:async name=>{rpcCalls.push(name);assert.equal(options?.db?.schema,'app');return{data:value,error:failure==='rpc'?{message:'PRIVATE'}:null};},
    from(table){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:table==='admin_users'?(active?{id:'admin',role,is_active:true}:null):{id:'check'},error:writeError?{message:'PRIVATE'}:null}),
      upsert(row){writes.push({table,row});return q;},insert(row){writes.push({table,row});return q;},then(resolve,reject){return Promise.resolve({data:[],error:writeError?{message:'PRIVATE'}:null}).then(resolve,reject);}};return q;}};return db;}
  load('supabase/functions/security-dashboard/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:client}},{Deno:{serve:fn=>handler=fn,env:{get:()=> 'fixture'}}});
  const token='h.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.s';
  return{rpcCalls,writes,request:action=>handler(new Request('https://example.test/security',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action})}))};
}
test('security endpoint enforces authenticated active admin and MFA before infrastructure or scan access',async()=>{
  for(const options of [{aal:'aal1'},{aal:null},{active:false},{user:false},{role:'guard'}]){
    for(const action of ['infrastructure_audit','run_security_scan','security_checks','search_audit_log']){const h=endpoint(options);assert((await h.request(action)).status>=400);assert.equal(h.rpcCalls.length,0);assert.equal(h.writes.length,0);}
  }
  const h=endpoint({role:'finance_admin'});assert.equal((await h.request('run_security_scan')).status,403);assert.equal(h.rpcCalls.length,0);
});
test('catalog or bucket failures and empty/malformed results never become healthy empty scan results',async()=>{
  for(const options of [{failure:'rpc'},{failure:'buckets'},{value:{...snapshot,tables:[]}},{value:{...snapshot,indexes:null}}]){
    for(const action of ['infrastructure_audit','run_security_scan']){const h=endpoint(options),r=await h.request(action);assert.equal(r.status,503);assert.equal(h.writes.length,0);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE/);}
  }
  const h=endpoint();assert.equal((await h.request('infrastructure_audit')).status,200);assert.deepEqual(h.rpcCalls,['get_admin_infrastructure_snapshot']);
});
test('successful scans preserve unknown external checks and a failed persistence cannot claim success',async()=>{
  const h=endpoint();assert.equal((await h.request('run_security_scan')).status,200);
  for(const key of ['jwt_functions','admin_sessions']){const check=h.writes.find(w=>w.row.check_key===key);assert.equal(check.row.status,'warning');assert.equal(check.row.score,0);}
  const failed=endpoint({writeError:true});const r=await failed.request('run_security_scan');assert.equal(r.status,500);assert.equal((await r.json()).success,undefined);
});
test('deployed recorded-check and audit-search routes are preserved and fail visibly on read errors',async()=>{
  for(const action of ['security_checks','search_audit_log']){
    assert.equal((await endpoint().request(action)).status,200);
    const r=await endpoint({writeError:true}).request(action);assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE/);
  }
});
test('missing database evidence shows a retry/error and blocks misleading report generation',()=>{
  const score=load('app/admin/security/OverallHealthScore.tsx').default({infrastructure:{tables:[]},stats:{},edgeFunctions:[]});
  const dbCard=nodes(score).find(n=>n.props?.children&&content(n).startsWith('Database'));
  assert.doesNotMatch(content(dbCard),/100%/);
  const panel=hooksHarness('app/admin/security/InfrastructureSecurityPanel.tsx');
  const tree=panel.render({infrastructure:null,infrastructureError:true,onRetry(){},edgeFunctions:[],apiSecrets:[]});
  assert(nodes(tree).some(n=>n.props?.role==='alert'));assert.match(content(tree),/Retry infrastructure audit/);assert.doesNotMatch(content(tree),/No tables found/);
  let documents=0;const report=hooksHarness('app/admin/security/GenerateReport.tsx',{jspdf:{jsPDF:class{constructor(){documents++;}}}});
  const result=report.render({stats:{failedLogins:0},loginEvents:[],resetEvents:[],infrastructure:{tables:[]},edgeFunctions:[],emergencySettings:{}});
  const generate=nodes(result).find(n=>n.type==='button'&&content(n).includes('Generate Security Report'));
  assert.equal(generate.props.disabled,true);generate.props.onClick();assert.equal(documents,0);assert.match(content(result),/Unavailable — database audit missing/);
});
test('storage totals are not divided by the maximum size of an individual uploaded file',async()=>{
  let handler;const bucket={name:'guard-documents',public:false,file_size_limit:5*1024*1024,allowed_mime_types:['application/pdf']};
  const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from(table){const q={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:async()=>({data:{id:'admin',is_active:true,full_name:'QA',role:'super_admin'}}),insert:()=>q,then(resolve,reject){return Promise.resolve({data:table==='buckets'?[bucket]:[],error:null}).then(resolve,reject);}};return q;}};
  load('supabase/functions/get-storage-usage/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{serve:fn=>handler=fn,env:{get:()=> 'fixture'}},fetch:async url=>new Response(JSON.stringify(url.endsWith('/get_storage_stats')?[{bucket_id:'guard-documents',file_count:24,total_bytes:20*1024*1024}]:[{bucket_name:'guard-documents'}]),{status:200})});
  const token='h.'+Buffer.from('{"aal":"aal2"}').toString('base64url')+'.s';
  const r=await handler(new Request('https://example.test/storage',{headers:{authorization:'Bearer '+token}}));assert.equal(r.status,200);
  const b=(await r.json()).buckets.find(b=>b.name==='guard-documents');assert.equal(b.total_bytes,20*1024*1024);assert.equal(b.file_size_limit,5*1024*1024);assert.equal(b.percentage_used,null);assert(!b.warnings.some(w=>w.includes('size limit')));
});
