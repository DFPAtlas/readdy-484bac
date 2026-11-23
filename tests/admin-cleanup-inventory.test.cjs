const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./helpers/enterprise-module.cjs');
const {hooksHarness,nodes,content,flush}=require('./helpers/guard-ui-fixture.cjs');
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_admin_cleanup_inventory.sql'));
const sql=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const names=['email_send_log','admin_registration_audit','email_queue','rate_limit_events','notifications','processed_stripe_events'];
function inventory(){return {sampled_at:new Date().toISOString(),targets:names.map((table_name,i)=>({table_name,target_relation:'public.'+table_name,relation_type:['email_queue','notifications','processed_stripe_events'].includes(table_name)?'view':'table',retention_days:[90,180,90,7,180,365][i],total_rows:table_name==='email_queue'||table_name==='notifications'?3:2,eligible_rows:1}))};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function fixture(){
 const db=new PGlite();await db.exec('create schema app;create role anon;create role authenticated;create role service_role;grant usage on schema app to anon,authenticated,service_role');
 for(const name of names){const schema=['email_queue','notifications','processed_stripe_events'].includes(name)?'app':'public';
  await db.exec(`create table ${schema}.${name}(id int primary key,created_at timestamptz,attempted_at timestamptz,processed_at timestamptz,status text,read boolean,is_read boolean);
   insert into ${schema}.${name} values(1,now()-interval '400 days',now()-interval '400 days',now()-interval '400 days','sent',true,false),(2,now()-interval '1 day',now()-interval '1 day',now()-interval '1 day','sent',true,false)`);
  if(schema==='app')await db.exec(`create view public.${name} as select * from app.${name}`);
  await db.exec(`grant select on public.${name} to service_role`);
 }
 await db.exec("insert into public.email_queue values(3,now()-interval '400 days',now(),now(),'pending',true,false);insert into public.notifications values(3,now()-interval '400 days',now(),now(),'sent',false,false);create table app.email_send_log(id int);insert into app.email_send_log select generate_series(1,95);create table app.rate_limit_events(id int);insert into app.rate_limit_events select generate_series(1,21)");
 await db.exec(sql);return db;
}
test('scheduled inventory counts exact configured targets and status predicates, including views, without reading duplicate app logs or deleting rows',async()=>{
 const db=await fixture();try{
  await db.exec('set role service_role');const result=(await db.query('select app.get_admin_cleanup_inventory() data')).rows[0].data;
  assert.equal(result.targets.length,6);assert.ok(Number.isFinite(Date.parse(result.sampled_at)));
  for(const expected of inventory().targets){const actual=result.targets.find(t=>t.table_name===expected.table_name);assert.deepEqual(actual,expected);}
  await db.exec('reset role');await db.exec(sql);
  assert.equal((await db.query('select count(*)::int n from app.email_send_log')).rows[0].n,95);
  for(const expected of inventory().targets)assert.equal((await db.query('select count(*)::int n from public.'+expected.table_name)).rows[0].n,expected.total_rows);
  const metadata=(await db.query("select prosecdef,provolatile,proconfig from pg_proc where proname='get_admin_cleanup_inventory'")).rows[0];
  assert.equal(metadata.prosecdef,false);assert.equal(metadata.provolatile,'s');assert.deepEqual(metadata.proconfig,['search_path=""']);
 }finally{await db.close();}
});
test('inventory RPC is service-only and lost relation privileges raise an error rather than confirmed zero counts',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select app.get_admin_cleanup_inventory()'),/permission denied/);await db.exec('reset role');}
  await db.exec('revoke select on public.email_send_log from service_role;set role service_role');
  await assert.rejects(db.query('select app.get_admin_cleanup_inventory()'),/permission denied/);
 }finally{await db.close();}
});
function readerFixture(){
 const f={session:{access_token:'fixture-token',user:{id:'admin-owner'}},response:inventory(),status:200,calls:[],sessionError:null,afterResponse:null};
 const db={auth:{getSession:async()=>({data:{session:f.session},error:f.sessionError})}};
 f.reader=load('lib/adminCleanupInventory.ts',{'@/lib/supabase':{supabase:db}},{fetch:async(url,options)=>{f.calls.push({url,options});f.afterResponse?.();return Response.json(f.response,{status:f.status});}});
 return f;
}
test('browser inventory reader uses a bounded authenticated private GET and preserves confirmed zeros',async()=>{
 const f=readerFixture();f.response.targets[0].total_rows=0;f.response.targets[0].eligible_rows=0;
 const result=await f.reader.loadAdminCleanupInventory();assert.equal(result.targets[0].total_rows,0);assert.equal(f.calls.length,1);
 assert.match(f.calls[0].url,/admin-system-status\?section=cleanup-inventory$/);assert.equal(f.calls[0].options.headers.Authorization,'Bearer fixture-token');
 assert.equal(f.calls[0].options.cache,'no-store');assert.ok(f.calls[0].options.signal instanceof AbortSignal);assert.ok(!f.calls[0].options.method||f.calls[0].options.method==='GET');
});
test('HTTP failures, absent/partial/duplicate/stale/malformed inventory and invalid counts never become zero inventory',async()=>{
 const variants=[r=>{r.targets=null;},r=>{r.targets.pop();},r=>{r.targets[1]=r.targets[0];},r=>{r.targets[0].total_rows=null;},r=>{r.targets[0].total_rows='0';},r=>{r.targets[0].total_rows=-1;},r=>{r.targets[0].total_rows=Number.MAX_SAFE_INTEGER+1;},r=>{r.targets[0].eligible_rows=3;},r=>{r.targets[0].target_relation='app.email_send_log';},r=>{r.targets[0].relation_type='unknown';},r=>{r.targets[0].relation_type=['view'];},r=>{r.sampled_at=new Date(Date.now()-6*60000).toISOString();},r=>{r.sampled_at=new Date(Date.now()+60000).toISOString();}];
 for(const alter of variants){const f=readerFixture();alter(f.response);await assert.rejects(f.reader.loadAdminCleanupInventory(),/Unable to verify/);}
 for(const status of [401,403,503]){const f=readerFixture();f.status=status;await assert.rejects(f.reader.loadAdminCleanupInventory(),/Unable to verify/);}
});
test('expired/changed admin sessions cannot fetch or accept inventory for another account',async()=>{
 for(const session of [null,{access_token:'fixture-token'}]){const f=readerFixture();f.session=session;await assert.rejects(f.reader.loadAdminCleanupInventory(),/session expired/);assert.equal(f.calls.length,0);}
 for(const session of [null,{access_token:'different-token',user:{id:'another-owner'}}]){const f=readerFixture();f.afterResponse=()=>{f.session=session;};await assert.rejects(f.reader.loadAdminCleanupInventory(),/session changed/);}
});
function endpoint({signed=true,aal='aal2',role='admin',active=true,error=false,throws=false}={}){
 let handler;const calls=[];const state=inventory();
 const db={auth:{getUser:async()=>({data:{user:signed?{id:'owner'}:null},error:null})},from:table=>{assert.equal(table,'admin_users');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:'admin',role,is_active:active}})};return q;},rpc:name=>{calls.push(name);const q={abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return q;},then:(resolve,reject)=>throws?Promise.reject(Error('PRIVATE QUERY ERROR')).then(resolve,reject):Promise.resolve({data:error?null:state,error:error?{message:'PRIVATE QUERY ERROR'}:null}).then(resolve,reject)};return q;}};
 load('supabase/functions/admin-system-status/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'fixture-service-secret'}},fetch:()=>{throw Error('Provider must not be probed');}});
 const token='header.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.signature';
 return {calls,state,call:(method='GET',authorization=true)=>handler(new Request('https://fixture.invalid/status?section=cleanup-inventory',{method,headers:authorization?{Authorization:'Bearer '+token}:{}}))};
}
test('private inventory endpoint checks valid identity, active admin role and MFA before its read and excludes other service probes',async()=>{
 for(const options of [{signed:false},{aal:'aal1'},{role:'guard'},{active:false}]){const f=endpoint(options);assert.ok((await f.call()).status>=400);assert.equal(f.calls.length,0);}
 const missing=endpoint();assert.equal((await missing.call('GET',false)).status,401);assert.equal(missing.calls.length,0);
 for(const role of ['admin','super_admin','finance_admin']){const f=endpoint({role});const response=await f.call();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),f.state);assert.deepEqual(f.calls,['get_admin_cleanup_inventory']);}
});
test('inventory endpoint read failures stay unavailable and method/preflight requests never invoke maintenance',async()=>{
 for(const options of [{error:true},{throws:true}]){const f=endpoint(options);const response=await f.call();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Unable to verify cleanup inventory'});}
 for(const [method,status] of [['OPTIONS',200],['POST',405],['DELETE',405]]){const f=endpoint();assert.equal((await f.call(method)).status,status);assert.equal(f.calls.length,0);}
});
function uiFixture(){
 const f={fail:true,calls:0,queue:[],data:inventory()};
 f.h=hooksHarness('app/admin/system-status/SystemStatusClient.tsx',{
  'next/link':{__esModule:true,default:()=>null},'@/components/admin/StorageUsageWidget':{__esModule:true,default:()=>null},
  '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:null}})},from:()=>{throw Error('Browser table counts must not be queried');}}},
  '@/lib/adminMaintenance':{loadAdminCleanupLogs:async()=>({logs:[],totalCount:0})},
  '@/lib/adminCleanupInventory':{loadAdminCleanupInventory:async()=>{f.calls++;if(f.queue.length)return f.queue.shift().promise;if(f.fail)throw Error('PRIVATE INVENTORY DETAIL');return f.data;}},
 },{setInterval:()=>1,clearInterval:()=>{},fetch:async()=>Response.json({error:'Fixture status denied'},{status:401})});return f;
}
const row=(h,name)=>nodes(h.render()).find(n=>n.type==='tr'&&content(n).includes(name));
test('actual admin maintenance table shows unknown on failure and Retry restores authenticated scheduled totals and eligibility',async()=>{
 const f=uiFixture();f.h.render();await f.h.effects();await flush();
 assert.match(content(row(f.h,'email_send_log')),/Not verifiedNot verified/);assert.match(content(f.h.render()),/Unable to verify cleanup inventory/);assert.doesNotMatch(content(f.h.render()),/PRIVATE INVENTORY DETAIL/);
 f.fail=false;await nodes(f.h.render()).find(n=>n.type==='button'&&content(n)==='Retry cleanup inventory').props.onClick();
 const tree=f.h.render();assert.match(content(row(f.h,'email_send_log')),/public.email_send_log · table90 days21/);
 assert.match(content(tree),/Inventory checked/);assert.doesNotMatch(content(tree),/Unable to verify cleanup inventory/);assert.equal(f.calls,2);f.h.unmount();
});
test('late inventory retries cannot overwrite a newer confirmed read or restore an unmounted inventory',async()=>{
 const f=uiFixture();f.h.render();await f.h.effects();await flush();const retry=nodes(f.h.render()).find(n=>n.type==='button'&&content(n)==='Retry cleanup inventory').props.onClick;
 const older=deferred(),newer=deferred();f.queue.push(older,newer);const a=retry(),b=retry();
 const fresh=inventory();fresh.targets[0].total_rows=80;newer.resolve(fresh);await b;
 older.reject(Error('stale private error'));await a;assert.match(content(row(f.h,'email_send_log')),/90 days801/);assert.doesNotMatch(content(f.h.render()),/Unable to verify cleanup inventory/);
 f.h.unmount();
 const g=uiFixture();g.h.render();await g.h.effects();await flush();const wait=deferred();g.queue.push(wait);const pending=nodes(g.h.render()).find(n=>n.type==='button'&&content(n)==='Retry cleanup inventory').props.onClick();g.h.unmount();const writes=g.h.writes;wait.resolve(inventory());await pending;assert.equal(g.h.writes,writes);
});
