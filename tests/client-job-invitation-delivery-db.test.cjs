const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_client_job_invitation_delivery.sql')),'utf8');
const U='00000000-0000-4000-8000-000000000001',C='00000000-0000-4000-8000-000000000002',G='00000000-0000-4000-8000-000000000003',GU='00000000-0000-4000-8000-000000000004',J='00000000-0000-4000-8000-000000000005',OTHER='00000000-0000-4000-8000-000000000006';
async function setup(){
 const db=new PGlite();
 await db.exec(`create schema app;create schema auth;create role authenticated;create role anon;create role service_role bypassrls;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth,app to authenticated,anon,service_role;
 create table auth.users(id uuid primary key,email text);
 create table app.clients(id uuid primary key,user_id uuid,is_active boolean default true);
 create table app.guards(id uuid primary key,user_id uuid,is_active boolean default true,verification_status text default 'approved',verified_by uuid default '${OTHER}',sia_verified boolean default true,sia_licence_number text default 'SYNTHETIC',sia_expiry_date date default current_date+365);
 create table app.jobs(id uuid primary key,client_id uuid,job_title text default 'Synthetic job',status text default 'open',payment_status text default 'pending',start_date date default current_date+1,start_time time default '12:00',is_deleted boolean default false,is_draft boolean default false,expires_at timestamptz);
 create table app.account_closures(user_id uuid primary key);
 create table app.job_invites(id uuid primary key default gen_random_uuid(),job_id uuid,guard_id uuid,client_id uuid,status text default 'pending',message text,invited_at timestamptz default now(),responded_at timestamptz,updated_at timestamptz default now(),unique(job_id,guard_id));
 create table app.notification_preferences(user_id uuid primary key,job_matches boolean default true,in_app_alerts boolean default true,email_frequency text default 'instant');
 create table app.notifications(id uuid default gen_random_uuid(),user_id uuid,user_type text,title text,message text,type text,category text,link text,data jsonb,is_read boolean);
 create table app.email_queue(id uuid primary key default gen_random_uuid(),user_id uuid,email_type text,recipient_email text not null,subject text not null,body_html text not null,status text,metadata jsonb,dedupe_key text);
 create function app.guard_has_current_sia(verified boolean,licence_number text,expiry date,check_date date) returns boolean language sql immutable set search_path='' as $$select coalesce(verified,false) and nullif(btrim(licence_number),'') is not null and expiry is not null and expiry>=check_date$$;
 grant select,insert,update,delete on app.clients,app.jobs,app.guards,app.job_invites,app.account_closures to authenticated,anon;
 alter table app.clients enable row level security;create policy owner on app.clients for select using(user_id=auth.uid());
 alter table app.jobs enable row level security;create policy owner on app.jobs for all using(client_id in(select id from app.clients where user_id=auth.uid()));
 alter table app.guards enable row level security;create policy own_guard on app.guards for select using(user_id=auth.uid());
 alter table app.job_invites enable row level security;
 create policy job_invites_client_select on app.job_invites for select using(client_id in(select id from app.clients where user_id=auth.uid()));
 create policy job_invites_guard_select on app.job_invites for select using(guard_id in(select id from app.guards where user_id=auth.uid()));
 create policy job_invites_guard_update on app.job_invites for update using(guard_id in(select id from app.guards where user_id=auth.uid()));
 create policy job_invites_client_insert on app.job_invites for insert with check(client_id in(select id from app.clients where user_id=auth.uid()));
 create policy job_invites_client_delete on app.job_invites for delete using(client_id in(select id from app.clients where user_id=auth.uid()));
 alter table app.account_closures enable row level security;create policy own_closure on app.account_closures for select using(user_id=auth.uid());
 insert into auth.users values('${U}','client@example.test'),('${GU}','guard@example.test');
 insert into app.clients(id,user_id) values('${C}','${U}'),('${OTHER}','${OTHER}');
 insert into app.guards(id,user_id) values('${G}','${GU}');insert into app.jobs(id,client_id) values('${J}','${C}');`);
 const phase=fs.readFileSync('supabase/migrations/20261006212325_immediate_booking_phase2.sql','utf8');
 await db.exec(phase.slice(phase.indexOf('CREATE OR REPLACE FUNCTION app.set_email_queue_dedupe_key()'),phase.indexOf('-- 6b-4.')));
 await db.exec('create trigger dedupe before insert or update on app.email_queue for each row execute function app.set_email_queue_dedupe_key()');
 await db.exec(migration);return db;
}
async function as(db,role,user,sql){await db.exec('begin');try{await db.exec(`set local role ${role}`);await db.query("select set_config('test.uid',$1,true)",[user||'']);const r=await db.query(sql);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
const create=`select app.create_client_job_invite('${J}','${G}','Synthetic invitation') as result`;
async function counts(db){return(await db.query(`select (select count(*)::int from app.job_invites) invites,(select count(*)::int from app.notifications) bells,(select count(*)::int from app.email_queue) emails`)).rows[0];}

test('actual migration atomically creates owned inbox/bell/queue, resolves auth recipient privately and replays without duplicates',async()=>{
 const db=await setup();try{
 const [a]=await as(db,'authenticated',U,create),[b]=await as(db,'authenticated',U,create);assert.equal(a.result.replayed,false);assert.equal(b.result.replayed,true);assert.equal(a.result.invite_id,b.result.invite_id);assert.deepEqual(await counts(db),{invites:1,bells:1,emails:1});
 const notification=(await db.query('select * from app.notifications')).rows[0];assert.equal(notification.user_id,GU);assert.equal(notification.user_type,'guard');assert.equal(notification.link,'/guard/job-invites');assert.equal(notification.data.invite_id,a.result.invite_id);
 const email=(await db.query('select * from app.email_queue')).rows[0];assert.equal(email.user_id,null);assert.equal(email.recipient_email,'guard@example.test');assert.equal(email.dedupe_key,'job-invite:'+a.result.invite_id);assert.equal(email.metadata.source_record_id,email.dedupe_key);
 assert.deepEqual((await as(db,'authenticated',GU,'select id from app.job_invites')).map(r=>r.id),[a.result.invite_id]);assert.equal((await as(db,'authenticated',OTHER,'select id from app.job_invites')).length,0);
 await as(db,'authenticated',GU,`update app.job_invites set status='declined',responded_at=now() where id='${a.result.invite_id}'`);assert.equal((await as(db,'authenticated',U,create))[0].result.status,'declined');assert.deepEqual(await counts(db),{invites:1,bells:1,emails:1});
 }finally{await db.close();}
});
test('foreign job/client, anonymous/guard callers and closed/inactive clients cannot create invitations or side effects',async()=>{
 const db=await setup();try{
 await assert.rejects(as(db,'anon',null,create),/permission denied/);await assert.rejects(as(db,'authenticated',GU,create),/not_authorized/);await assert.rejects(as(db,'authenticated',OTHER,create),/not_authorized/);
 await assert.rejects(as(db,'authenticated',U,`insert into app.job_invites(job_id,guard_id,client_id) values('${J}','${G}','${OTHER}')`),/not_authorized|row-level/);
 await db.exec(`insert into app.account_closures values('${U}')`);await assert.rejects(as(db,'authenticated',U,create),/not_authorized/);await db.exec('delete from app.account_closures');await db.exec(`update app.clients set is_active=false where id='${C}'`);await assert.rejects(as(db,'authenticated',U,create),/not_authorized/);assert.deepEqual(await counts(db),{invites:0,bells:0,emails:0});
 }finally{await db.close();}
});
test('terminal/deleted/draft/expired/started jobs and inactive/unapproved/expired guards fail closed on RPC and direct insert',async()=>{
 const db=await setup();try{
 for(const sql of ["status='paid_out'","payment_status='funded'","is_deleted=true","is_draft=true","expires_at=now()-interval '1 minute'","start_date=current_date-1"]){await db.exec('begin');await db.exec(`update app.jobs set ${sql}`);await db.exec('savepoint attempt');await assert.rejects(db.query(`insert into app.job_invites(job_id,guard_id,client_id) values('${J}','${G}','${C}')`),/job_unavailable/);await db.exec('rollback');}
 for(const sql of ["is_active=false","verification_status='pending'","verified_by=null","sia_verified=false","sia_expiry_date=current_date-1","sia_licence_number=''" ]){await db.exec(`update app.guards set ${sql}`);await assert.rejects(as(db,'authenticated',U,create),/guard_unavailable/);await db.exec(`update app.guards set is_active=true,verification_status='approved',verified_by='${OTHER}',sia_verified=true,sia_expiry_date=current_date+365,sia_licence_number='SYNTHETIC'`);}
 await db.exec(`insert into app.account_closures values('${GU}')`);await assert.rejects(as(db,'authenticated',U,create),/guard_unavailable/);assert.deepEqual(await counts(db),{invites:0,bells:0,emails:0});
 }finally{await db.close();}
});
test('queue/notification write failure rolls back invitation and every side effect; retry succeeds once',async()=>{
 const db=await setup();try{
 await db.exec(`create function app.fail_queue() returns trigger language plpgsql as $$begin raise exception 'synthetic queue failure';end$$;create trigger fail before insert on app.email_queue for each row execute function app.fail_queue()`);
 await assert.rejects(as(db,'authenticated',U,create),/synthetic queue failure/);assert.deepEqual(await counts(db),{invites:0,bells:0,emails:0});await db.exec('drop trigger fail on app.email_queue');await as(db,'authenticated',U,create);assert.deepEqual(await counts(db),{invites:1,bells:1,emails:1});
 }finally{await db.close();}
});
test('notification preference suppresses bell without losing inbox; missing email does not invent delivery',async()=>{
 const db=await setup();try{
 await db.exec(`insert into app.notification_preferences(user_id,in_app_alerts) values('${GU}',false);update auth.users set email=null where id='${GU}'`);
 await as(db,'authenticated',U,create);assert.deepEqual(await counts(db),{invites:1,bells:0,emails:0});
 }finally{await db.close();}
});
test('bindings/messages are immutable, delete/recreate is denied and trigger functions are not browser callable',async()=>{
 const db=await setup();try{
 await as(db,'authenticated',U,create);await assert.rejects(as(db,'authenticated',GU,`update app.job_invites set client_id='${OTHER}'`),/immutable/);await assert.rejects(as(db,'authenticated',U,'delete from app.job_invites'),/permission denied/);
 for(const name of ['validate_client_job_invite','queue_client_job_invite'])assert.equal((await db.query(`select has_function_privilege('authenticated','app.${name}()','execute') allowed`)).rows[0].allowed,false);
 await db.exec(migration);assert.deepEqual(await counts(db),{invites:1,bells:1,emails:1});
 }finally{await db.close();}
});
