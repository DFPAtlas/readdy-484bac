const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const read = name => fs.readFileSync('supabase/migrations/' + name, 'utf8');
const migration = read('20261126164948_scheduled_job_publication.sql');
const free = read('20261125173242_free_guard_application_access.sql');
const phase2 = read('20261006212325_immediate_booking_phase2.sql');
const client = randomUUID(), guard = randomUUID();

async function setup() {
  const db = new PGlite();
  await db.exec(`create schema app; create schema auth; create schema cron;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema app to anon,authenticated,service_role;
    create table app.users(id uuid primary key);
    create table app.clients(id uuid primary key,client_type text,is_active boolean default true,is_suspended boolean default false,profile_completed boolean default true);
    create table app.guards(id uuid primary key,user_id uuid default gen_random_uuid(),email text default 'synthetic@example.invalid',full_name text default 'Synthetic guard',is_active boolean default true,verification_status text default 'approved',verified_by uuid default gen_random_uuid(),profile_completed boolean default true,willing_to_travel boolean default true,home_latitude numeric default 51.5,home_longitude numeric default -0.1,max_distance_miles numeric default 10,default_search_radius_km numeric,min_hourly_rate numeric default 0,licence_types text[] default array['Door Supervisor'],sia_verified boolean default true,sia_licence_number text default 'SYNTHETIC',sia_expiry_date date default '2099-12-31',accepts_direct_bookings boolean default true,preferred_venue_categories text[]);
    create table app.jobs(id uuid primary key default gen_random_uuid(),client_id uuid default '${client}',status text default 'draft',is_draft boolean default true,is_deleted boolean default false,sia_licence_required boolean default true,publish_at timestamptz default now()-interval '1 minute',expires_at timestamptz,start_date date default '2099-12-01',start_time time default '09:00',end_time time default '17:00',latitude numeric default 51.5,longitude numeric default -0.1,venue_category text,required_license_type text,security_type text default 'door-supervisor',urgency text,booking_source text,hourly_rate numeric default 15,job_title text default 'Synthetic scheduled publication',contact_name text,venue_name text,venue_city text,notification_status text default 'none',notification_error text,notification_attempts integer default 0,notification_last_attempt_at timestamptz,notified_guard_count integer default 0,notified_at timestamptz);
    alter table app.jobs enable row level security;
    create policy visible_jobs on app.jobs for select to authenticated using(status='open' and not is_deleted);
    grant select on app.jobs to authenticated;
    create table app.email_queue(id uuid primary key default gen_random_uuid(),user_id uuid references app.users(id),email_type text,recipient_email text,recipient_name text,subject text,body_html text,status text,priority integer,metadata jsonb,dedupe_key text,error_message text,retry_count integer default 0,created_at timestamptz default now(),updated_at timestamptz);
    create unique index uq_email_queue_job_match_dedupe on app.email_queue(dedupe_key) where email_type='job_match';
    create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
    create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid$$;
    create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;
    insert into app.clients(id) values('${client}');
    insert into app.guards(id) values('${guard}');
    insert into app.guards(id,verified_by) values(gen_random_uuid(),null);
    insert into app.guards(id,home_latitude) values(gen_random_uuid(),55);
    grant select,update on app.jobs to service_role;
    grant select on app.clients to service_role;`);
  await db.exec(read('20261122014216_profile_only_job_match_queue.sql'));
  await db.exec(phase2.slice(phase2.indexOf('CREATE OR REPLACE FUNCTION app.recompute_job_notification_status('),phase2.indexOf('-- 6f.')));
  await db.exec(free.slice(free.indexOf('CREATE OR REPLACE FUNCTION public.notify_matching_guards_on_job_post()')));
  await db.exec(`create trigger original_insert_alert after insert on app.jobs for each row when(new.status='open') execute function public.notify_matching_guards_on_job_post();`);
  await db.exec(migration);
  return db;
}
const run = async(db, limit=50) => (await db.query('select app.publish_due_scheduled_jobs($1) result',[limit])).rows[0].result;
const job = async(db, changes='') => (await db.query(`insert into app.jobs ${changes || 'default values'} returning id`)).rows[0].id;

test('scheduled publisher executes actual matching/queue SQL with atomic retry and restricted access',async t=>{
  const db=await setup();
  const reset=()=>db.exec('delete from app.email_queue;delete from app.jobs;');
  t.afterEach(()=>db.exec('reset role'));
  try {
    await t.test('future drafts remain hidden; due jobs publish and queue once across retries and ordinary updates',async()=>{
      const id=await job(db,"(publish_at) values(now()+interval '1 hour')");
      assert.equal((await run(db)).published,0);
      await db.exec('set role authenticated');assert.equal((await db.query('select * from app.jobs')).rows.length,0);await db.exec('reset role');
      await db.query("update app.jobs set publish_at=now()-interval '1 second' where id=$1",[id]);
      const first=await run(db);assert.equal(first.published,1);assert.equal(first.failed,0);assert.deepEqual(first.job_ids,[id]);
      const saved=(await db.query('select * from app.jobs')).rows[0];assert.equal(saved.status,'open');assert.equal(saved.is_draft,false);assert.equal(saved.notification_status,'queued');assert.equal(saved.notified_guard_count,0);
      assert.equal((await run(db)).published,0);
      await db.query("update app.jobs set status='open',is_draft=false,job_title='Updated synthetic title' where id=$1",[id]);
      const rows=(await db.query('select * from app.email_queue')).rows;assert.equal(rows.length,1);assert.equal(rows[0].dedupe_key,`job:${id}:guard:${guard}`);assert.equal(rows[0].status,'pending');
      await db.exec('set role authenticated');assert.equal((await db.query('select * from app.jobs')).rows.length,1);await db.exec('reset role');
    });
    await t.test('queue failure rolls publication back while healthy jobs continue; repair retries without duplicates',async()=>{
      await reset();const bad=await job(db), good=await job(db);
      await db.exec(`create function app.reject_synthetic_queue() returns trigger language plpgsql as $$begin if new.metadata->>'job_id'='${bad}' then raise exception 'synthetic_queue_failure';end if;return new;end$$;
        create trigger synthetic_failure before insert on app.email_queue for each row execute function app.reject_synthetic_queue();`);
      const r=await run(db);assert.equal(r.published,1);assert.equal(r.failed,1);assert.deepEqual(r.job_ids,[good]);
      assert.equal((await db.query('select status from app.jobs where id=$1',[bad])).rows[0].status,'draft');
      assert.equal((await db.query('select * from app.email_queue')).rows.length,1);
      await db.exec('drop trigger synthetic_failure on app.email_queue');
      assert.equal((await run(db)).published,1);assert.equal((await run(db)).published,0);
      assert.equal((await db.query('select * from app.email_queue')).rows.length,2);
    });
    await t.test('a later matching-guard queue failure rolls back earlier queues and the publication together',async()=>{
      await reset();const id=await job(db),later='ffffffff-ffff-4fff-8fff-ffffffffffff';
      await db.query('insert into app.guards(id) values($1)',[later]);
      await db.exec(`create function app.reject_later_guard() returns trigger language plpgsql as $$begin if new.metadata->>'guard_record_id'='${later}' then raise exception 'synthetic_later_guard_failure';end if;return new;end$$;
        create trigger synthetic_later_failure before insert on app.email_queue for each row execute function app.reject_later_guard();`);
      const failed=await run(db);assert.equal(failed.published,0);assert.equal(failed.failed,1);
      assert.equal((await db.query('select * from app.email_queue')).rows.length,0);
      assert.equal((await db.query('select status from app.jobs where id=$1',[id])).rows[0].status,'draft');
      await db.exec('drop trigger synthetic_later_failure on app.email_queue');
      assert.equal((await run(db)).published,1);assert.equal((await db.query('select * from app.email_queue')).rows.length,2);
      await db.query('delete from app.guards where id=$1',[later]);
    });
    await t.test('deleted, cancelled, expired, unscheduled, inconsistent and already-started jobs are untouched',async()=>{
      await reset();
      for(const cols of ["(is_deleted) values(true)","(status) values('cancelled')","(expires_at) values(now()-interval '1 second')","(publish_at) values(null)","(is_draft) values(false)","(start_date) values(current_date-1)","(start_time) values(null)"]){await job(db,cols);}
      for(const flag of ['is_active=false','is_suspended=true','profile_completed=false']){
        const other=randomUUID();await db.query('insert into app.clients(id) values($1)',[other]);await db.query('update app.clients set '+flag+' where id=$1',[other]);await job(db,`(client_id) values('${other}')`);
      }
      const before=(await db.query('select * from app.jobs order by id')).rows;
      assert.equal((await run(db)).published,0);assert.deepEqual((await db.query('select * from app.jobs order by id')).rows,before);assert.equal((await db.query('select * from app.email_queue')).rows.length,0);
    });
    await t.test('invalid limits and untrusted roles cannot publish; service role can run a bounded batch',async()=>{
      await reset();await job(db);await job(db);
      for(const limit of [null,0,-1,101])await assert.rejects(run(db,limit),e=>e.code==='22023');
      for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(run(db),e=>e.code==='42501');await db.exec('reset role');}
      const acl=(await db.query("select prosecdef from pg_proc where oid='app.publish_due_scheduled_jobs(integer)'::regprocedure")).rows[0];assert.equal(acl.prosecdef,false);
      await db.exec('set role service_role');assert.equal((await run(db,1)).published,1);assert.equal((await run(db,1)).published,1);assert.equal((await run(db,1)).published,0);await db.exec('reset role');
      assert.equal((await db.query('select * from app.email_queue')).rows.length,2);
    });
    await t.test('existing direct-insert matching retains its non-blocking queue-failure behaviour',async()=>{
      await reset();await db.exec(`create trigger synthetic_failure before insert on app.email_queue for each row execute function app.reject_synthetic_queue();`);
      // Reuse the failing job ID encoded in the fixture trigger's function.
      const text=(await db.query("select prosrc from pg_proc where oid='app.reject_synthetic_queue()'::regprocedure")).rows[0].prosrc;
      const bad=text.match(/job_id'='([^']+)'/)[1];
      await db.query("insert into app.jobs(id,status,is_draft) values($1,'open',false)",[bad]);
      assert.equal((await db.query('select status from app.jobs')).rows[0].status,'open');assert.equal((await db.query('select * from app.email_queue')).rows.length,0);await db.exec('drop trigger synthetic_failure on app.email_queue');
    });
    await t.test('cron installs paused; migration replay preserves activation and rejects foreign name collisions',async()=>{
      const c=(await db.query("select * from cron.job where jobname='publish-scheduled-jobs'")).rows[0];assert.equal(c.active,false);assert.equal(c.schedule,'* * * * *');
      await db.exec("update cron.job set active=true where jobname='publish-scheduled-jobs'");await db.exec(migration);
      const rows=(await db.query('select * from cron.job')).rows;assert.equal(rows.length,1);assert.equal(rows[0].active,true);
      await db.exec("update cron.job set command='select unrelated_work();'");
      await assert.rejects(db.exec(migration),/scheduled_publication_cron_name_conflict/);
      assert.equal((await db.query('select command from cron.job')).rows[0].command,'select unrelated_work();');
    });
  } finally {await db.close();}
});
