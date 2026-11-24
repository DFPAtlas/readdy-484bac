const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,service,invoke,actor,other,names}=require('./helpers/manual-cleanup-fixture.cjs');
async function owner(db){await db.exec('reset role');}
async function counters(db){await owner(db);return (await db.query("select (select count(*)::int from public.cleanup_log) logs,(select count(*)::int from app.admin_activity_log) audits,(select count(*)::int from app.admin_cleanup_requests where status='completed') completed")).rows[0];}
test('reviewed six-target preview never deletes; confirmed execution retains pending/unread/fresh records and writes one genuine receipt/audit',async()=>{
 const db=await fixture();try{
  await service(db);const preview=await invoke(db,'preview');assert.equal(preview.status,'previewed');assert.equal(preview.inventory.targets.length,6);assert.ok(preview.inventory.targets.every(t=>t.eligible_rows===1));
  assert.deepEqual(await counters(db),{logs:0,audits:0,completed:0});await service(db);
  const receipt=await invoke(db,'execute',preview.request_id,true);assert.equal(receipt.status,'completed');assert.equal(receipt.total_removed,6);assert.equal(receipt.results.length,6);
  const replay=await invoke(db,'execute',preview.request_id,true);assert.deepEqual(replay,receipt);assert.deepEqual(await invoke(db,'status',preview.request_id),receipt);
  assert.deepEqual(await counters(db),{logs:6,audits:1,completed:1});
  for(const name of names)assert.equal((await db.query('select count(*)::int n from public.'+name)).rows[0].n,['email_queue','notifications'].includes(name)?2:1);
  const audit=(await db.query('select * from app.admin_activity_log')).rows[0];assert.equal(audit.admin_user_id,actor);assert.equal(audit.metadata.actor_user_id,actor);assert.equal(audit.metadata.request_id,preview.request_id);assert.equal(audit.metadata.receipt.total_removed,6);assert.equal(audit.admin_username,'admin@fixture.invalid');
 }finally{await db.close();}
});
test('browser grants, cross-admin requests, finance/inactive/closed actors and missing confirmation cannot start cleanup',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(invoke(db,'preview'),/permission denied/);await db.exec('reset role');}
  await service(db);const p=await invoke(db,'preview');
  await assert.rejects(invoke(db,'execute',p.request_id,false),/Explicit confirmation/);
  await assert.rejects(invoke(db,'execute',p.request_id,true,other),/Request not found/);
  for(const mode of ['finance','inactive','closed']){
   await owner(db);await db.exec(mode==='finance'?`update app.admin_users set role='finance_admin' where user_id='${actor}'`:mode==='inactive'?`update app.admin_users set role='super_admin',is_active=false where user_id='${actor}'`:`update app.admin_users set is_active=true where user_id='${actor}';insert into app.account_closures values('${actor}')`);
   await service(db);await assert.rejects(invoke(db,'execute',p.request_id,true),/Admin access required/);
  }
  assert.deepEqual(await counters(db),{logs:0,audits:0,completed:0});
 }finally{await db.close();}
});
test('expiry or any changed eligible row invalidates the server-owned preview even when eligible counts remain the same',async()=>{
 const db=await fixture();try{
  await service(db);const expired=await invoke(db,'preview');await owner(db);await db.query("update app.admin_cleanup_requests set expires_at=now()-interval '1 second' where id=$1",[expired.request_id]);await service(db);
  await assert.rejects(invoke(db,'execute',expired.request_id,true),/Preview expired/);assert.equal((await invoke(db,'status',expired.request_id)).status,'preview_expired');
  const changed=await invoke(db,'preview');await owner(db);await db.exec("update public.email_queue set status='failed' where status='sent' and created_at<now()-interval '90 days'");await service(db);
  await assert.rejects(invoke(db,'execute',changed.request_id,true),/Eligible records changed/);assert.equal((await invoke(db,'status',changed.request_id)).status,'preview_expired');
  assert.deepEqual(await counters(db),{logs:0,audits:0,completed:0});
 }finally{await db.close();}
});
test('new noneligible rows do not expand the reviewed deletion and parallel duplicate submissions resolve to the same durable receipt',async()=>{
 const db=await fixture();try{
  await service(db);const p=await invoke(db,'preview');await owner(db);await db.exec("insert into public.email_queue values(gen_random_uuid(),now(),now(),now(),'pending',false,false)");await service(db);
  // PGlite serializes backend statements; this checks duplicate dispatch, not real multi-session lock contention.
  const [a,b]=await Promise.all([invoke(db,'execute',p.request_id,true),invoke(db,'execute',p.request_id,true)]);assert.deepEqual(a,b);assert.equal(a.total_removed,6);
  assert.deepEqual(await counters(db),{logs:6,audits:1,completed:1});assert.equal((await db.query('select count(*)::int n from public.email_queue')).rows[0].n,3);
 }finally{await db.close();}
});
test('a late retention or audit failure rolls back every deletion and completion without manufacturing a successful receipt',async()=>{
 for(const mode of ['retention','audit']){
  const db=await fixture();try{
   await service(db);const p=await invoke(db,'preview');await owner(db);
   if(mode==='audit')await db.exec('alter table app.admin_activity_log add constraint fixture_reject_audit check (false)');
   else await db.exec("create table public.fixture_hold(id uuid references public.email_send_log(id) on delete restrict);insert into public.fixture_hold select id from public.email_send_log where created_at<now()-interval '90 days'");
   await service(db);await assert.rejects(invoke(db,'execute',p.request_id,true));
   assert.deepEqual(await counters(db),{logs:0,audits:0,completed:0});for(const name of names)assert.equal((await db.query('select count(*)::int n from public.'+name)).rows[0].n,['email_queue','notifications'].includes(name)?3:2);
  }finally{await db.close();}
 }
});
test('changed routine bodies, compatibility mappings, DELETE statement hooks and cascading references fail closed before execution',async()=>{
 for(const mode of ['routine','mapping','hook','cascade']){
  const db=await fixture();try{
   await service(db);const p=await invoke(db,'preview');await owner(db);
   if(mode==='routine')await db.exec("create or replace function public.fn_cleanup_email_send_log() returns void language plpgsql security definer set search_path='' as $$begin null;end$$");
   if(mode==='mapping')await db.exec('drop view public.email_queue;create view public.email_queue as select * from app.notifications;grant select,insert,update,delete on public.email_queue to service_role');
   if(mode==='hook')await db.exec("create function app.fixture_delete_hook() returns trigger language plpgsql as $$begin return old;end$$;create trigger fixture_delete_hook before delete on app.email_queue for each statement execute function app.fixture_delete_hook()");
   if(mode==='cascade')await db.exec('create table public.fixture_cascade(id uuid references public.email_send_log(id) on delete cascade)');
   await service(db);await assert.rejects(invoke(db,'execute',p.request_id,true),/changed|configuration|reference/);
   assert.deepEqual(await counters(db),{logs:0,audits:0,completed:0});
  }finally{await db.close();}
 }
});
