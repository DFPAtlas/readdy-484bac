const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_repair_cleanup_scheduler_evidence.sql'));
const sql=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const targets=['admin_registration_audit','email_queue','email_send_log','notifications','processed_stripe_events','rate_limit_events'];
const names=targets.map(t=>'fn_cleanup_'+t);
async function fixture(){
 const db=new PGlite();await db.exec(`create schema auth;create schema app;create schema cron;create schema extensions;
 create role anon;create role authenticated;create role service_role;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')$$;
 create function extensions.gen_random_uuid() returns uuid language sql as $$select pg_catalog.gen_random_uuid()$$;
 create table public.cleanup_log(id uuid primary key,table_name text,rows_removed int,retention_days int,started_at timestamptz default now(),finished_at timestamptz,status text default 'running',error_message text,created_at timestamptz default now());
 create table cron.job(jobid bigint,jobname text,schedule text,active boolean,command text);
 create table cron.job_run_details(runid bigint,jobid bigint,status text,start_time timestamptz,end_time timestamptz,return_message text);
 grant usage on schema app,cron to service_role;grant select on public.cleanup_log,cron.job,cron.job_run_details to service_role;
 grant usage on schema app to anon,authenticated;
 insert into cron.job values(1,'unrelated','0 * * * *',true,'PRIVATE COMMAND');`);
 for(const table of targets)await db.exec(`create table public.${table}(id int primary key,created_at timestamptz,processed_at timestamptz,attempted_at timestamptz,status text,read boolean,is_read boolean);
 insert into public.${table} values(1,now()-interval '400 days',now()-interval '400 days',now()-interval '400 days','sent',true,false),(2,now()-interval '1 day',now()-interval '1 day',now()-interval '1 day','sent',true,false);`);
 await db.exec("insert into public.email_queue values(3,now()-interval '400 days',now(),now(),'pending',true,false);insert into public.notifications values(3,now()-interval '400 days',now(),now(),'sent',false,false)");
 return db;
}
test('reproduces the old cron false-success before repair without manufacturing an audit record',async()=>{
 const db=await fixture();try{
  const text=fs.readFileSync('supabase/migrations/20260827_p0_security_definer_rpc_lockdown.sql','utf8');
  const a=text.indexOf('CREATE OR REPLACE FUNCTION public.fn_cleanup_email_send_log()'),b=text.indexOf('$function$;',text.indexOf('AS $function$',a))+12;
  await db.exec(text.slice(a,b));await db.query('select public.fn_cleanup_email_send_log()');
  assert.equal((await db.query('select count(*)::int n from public.email_send_log')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,0);
 }finally{await db.close();}
});
test('trusted postgres scheduler runs preserve all retention predicates and write actual completion counts once per invocation',async()=>{
 const db=await fixture();try{
  await db.exec(sql);for(const name of names)await db.query('select public.'+name+'()');
  for(const target of targets){const ids=(await db.query('select id from public.'+target+' order by id')).rows.map(r=>r.id);assert.deepEqual(ids,['email_queue','notifications'].includes(target)?[2,3]:[2]);}
  const logs=(await db.query('select table_name,rows_removed,status,retention_days,finished_at from public.cleanup_log order by table_name')).rows;
  assert.equal(logs.length,6);assert.ok(logs.every(r=>r.status==='completed'&&r.rows_removed===1&&r.finished_at));
  assert.deepEqual(logs.map(r=>r.retention_days),[180,90,90,180,365,7]);
  const state=(await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data;
  assert.equal(state.cleanup.status,'healthy');assert.equal(state.cleanup.recent_completed_tables,6);assert.doesNotMatch(JSON.stringify(state),/PRIVATE COMMAND/);
  await db.exec(sql);assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,6);
  await db.query('select public.fn_cleanup_email_send_log()');assert.equal((await db.query("select rows_removed from public.cleanup_log where table_name='email_send_log' order by created_at desc limit 1")).rows[0].rows_removed,0);
 }finally{await db.close();}
});
test('anonymous/authenticated execution stays revoked and signed caller context cannot impersonate the scheduler inside a definer',async()=>{
 const db=await fixture();try{
  await db.exec(sql);
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.fn_cleanup_email_send_log()'),/permission denied/);await db.exec('reset role');}
  await db.exec('grant execute on function public.fn_cleanup_email_send_log() to authenticated');
  for(const claims of ['','{"role":"authenticated"}','{"role":"authenticated","user_metadata":{"role":"service_role"}}']){
   await db.query("select set_config('request.jwt.claims',$1,false)",[claims]);await db.exec('set role authenticated');
   await assert.rejects(db.query('select public.fn_cleanup_email_send_log()'),/Access denied/);await db.exec('reset role');
  }
  await db.query("select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false)");
  await assert.rejects(db.query('select public.fn_cleanup_email_send_log()'),/Access denied/);
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,0);
  await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");await db.exec('set role service_role');
  await db.query('select public.fn_cleanup_email_send_log()');await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,1);
 }finally{await db.close();}
});
test('cleanup failures roll back deletion and propagate instead of reporting a successful cron row',async()=>{
 const db=await fixture();try{
  await db.exec(sql);await db.exec("create function public.reject_cleanup() returns trigger language plpgsql as $$begin raise exception 'fixture delete denied'; end$$;create trigger reject_cleanup before delete on public.email_send_log for each row execute function public.reject_cleanup()");
  await assert.rejects(db.query('select public.fn_cleanup_email_send_log()'),/fixture delete denied/);
  assert.equal((await db.query('select count(*)::int n from public.email_send_log')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,0);
 }finally{await db.close();}
});
test('old, partial, future and failed cleanup evidence cannot make private maintenance healthy',async()=>{
 const db=await fixture();try{
  await db.exec(sql);assert.equal((await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data.cleanup.status,'degraded');
  for(const table of targets)await db.query("insert into public.cleanup_log(id,table_name,status,started_at,finished_at) values(gen_random_uuid(),$1,'completed',now()-interval '90 days',now()-interval '90 days')",[table]);
  let data=(await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data;assert.equal(data.cleanup.recent_completed_tables,0);assert.equal(data.cleanup.status,'degraded');
  await db.exec("update public.cleanup_log set started_at=now(),finished_at=now() where table_name!='rate_limit_events'");
  assert.equal((await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data.cleanup.recent_completed_tables,5);
  await db.exec("update public.cleanup_log set started_at=now()+interval '1 day',finished_at=now()+interval '1 day' where table_name='rate_limit_events'");
  assert.equal((await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data.cleanup.status,'degraded');
  await db.exec("update public.cleanup_log set started_at=now(),finished_at=now() where table_name='rate_limit_events'");
  assert.equal((await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data.cleanup.status,'healthy');
  await db.exec("insert into public.cleanup_log(id,table_name,status) values(gen_random_uuid(),'email_queue','failed')");
  assert.equal((await db.query('select app.get_admin_maintenance_snapshot() data')).rows[0].data.cleanup.status,'degraded');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select app.get_admin_maintenance_snapshot()'),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});
test('the operational verification refuses any eligible deletion and only commits genuine zero-removal runs',async()=>{
 const db=await fixture();try{
  await db.exec(sql);const verification=fs.readFileSync('scripts/ops/20261123-verify-cleanup-zero-deletions.sql','utf8');
  await assert.rejects(db.exec(verification),/Eligible rows exist/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log')).rows[0].n,0);
  for(const table of targets)await db.exec('update public.'+table+' set created_at=now(),processed_at=now(),attempted_at=now()');
  await db.exec(verification);
  assert.equal((await db.query('select count(*)::int n from public.cleanup_log where status=\'completed\' and rows_removed=0')).rows[0].n,6);
  assert.equal((await db.query('select count(*)::int n from public.notifications')).rows[0].n,3);
 }finally{await db.close();}
});
