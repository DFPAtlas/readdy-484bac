const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const names=['admin_registration_audit','email_queue','email_send_log','notifications','processed_stripe_events','rate_limit_events'];
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_admin_manual_cleanup.sql'));
const sql=fs.readFileSync('supabase/migrations/'+migration,'utf8');
const actor='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
async function fixture(){
 const db=new PGlite();await db.exec(`create schema app;create schema auth;create schema cron;create schema extensions;
 create role anon;create role authenticated;create role service_role;
 grant usage on schema app,auth,extensions,cron to service_role;
 grant usage on schema app to anon,authenticated;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'$$;
 create function extensions.gen_random_uuid() returns uuid language sql as $$select pg_catalog.gen_random_uuid()$$;
 create table app.admin_users(id uuid primary key,user_id uuid,full_name text,email text,role text,is_active boolean);
 insert into app.admin_users values('${actor}','${actor}','Synthetic Admin','admin@fixture.invalid','super_admin',true),('${other}','${other}','Other Admin','other@fixture.invalid','admin',true);
 create table app.account_closures(user_id uuid);
 create table app.admin_activity_log(id uuid primary key default gen_random_uuid(),admin_username text,admin_name text,admin_user_id uuid references app.admin_users(id),action_type text,action_description text,target_type text,target_name text,metadata jsonb,changes jsonb);
 create table public.cleanup_log(id uuid primary key,table_name text,rows_removed int,retention_days int,started_at timestamptz,finished_at timestamptz,status text default 'running',error_message text,created_at timestamptz default now());
 create table cron.job(jobid bigint,jobname text,schedule text,active boolean,command text);create table cron.job_run_details(runid bigint,jobid bigint,status text,start_time timestamptz,end_time timestamptz,return_message text);
 grant select on cron.job,cron.job_run_details to service_role;
 grant select,insert on app.admin_activity_log to service_role;
 grant select on app.admin_users,app.account_closures to service_role;grant update on app.admin_users to service_role;
 grant select,insert,update,delete on public.cleanup_log to service_role;`);
 for(const name of names){const schema=['email_queue','notifications','processed_stripe_events'].includes(name)?'app':'public';
  await db.exec(`create table ${schema}.${name}(id uuid primary key,created_at timestamptz,processed_at timestamptz,attempted_at timestamptz,status text,read boolean,is_read boolean);
  insert into ${schema}.${name} values(gen_random_uuid(),now()-interval '400 days',now()-interval '400 days',now()-interval '400 days','sent',true,false),(gen_random_uuid(),now()-interval '1 day',now()-interval '1 day',now()-interval '1 day','sent',true,false);
  grant select,insert,update,delete on ${schema}.${name} to service_role;`);
  if(schema==='app')await db.exec(`create view public.${name} as select * from app.${name};grant select,insert,update,delete on public.${name} to service_role`);
 }
 await db.exec("insert into public.email_queue values(gen_random_uuid(),now()-interval '400 days',now(),now(),'pending',true,false);insert into public.notifications values(gen_random_uuid(),now()-interval '400 days',now(),now(),'sent',false,false)");
 await db.exec(fs.readFileSync('supabase/migrations/20261123212923_repair_cleanup_scheduler_evidence.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_admin_cleanup_inventory.sql')),'utf8'));
 await db.exec(sql);
 return db;
}
async function service(db){await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");await db.exec('set role service_role');}
async function invoke(db,action,id=null,confirmed=false,user=actor){return (await db.query('select app.admin_manual_cleanup($1::uuid,$2::text,$3::uuid,$4::boolean) data',[user,action,id,confirmed])).rows[0].data;}
module.exports={fixture,service,invoke,actor,other,names,sql};
