const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const U='11111111-1111-4111-8111-111111111111', G='22222222-2222-4222-8222-222222222222', J='33333333-3333-4333-8333-333333333333', I='44444444-4444-4444-8444-444444444444';

test('expired application rejection rolls back usage and keeps invitations retryable in actual PostgreSQL', async t => {
  const db=new PGlite();
  try {
    await db.exec(`create schema app;create role anon;create role authenticated;create role service_role;
      create table app.guards(id uuid primary key,user_id uuid,is_active boolean,verified_by uuid,verification_status text,sia_expiry_date date,sia_verified boolean,sia_licence_number text,licence_types text[]);
      create table app.jobs(id uuid primary key,status text,is_deleted boolean,start_date date,sia_licence_required boolean,required_licence_types text[],job_access_level text);
      create table app.job_invites(id uuid primary key,guard_id uuid,job_id uuid,status text,responded_at timestamptz);
      create table app.job_applications(id uuid primary key default gen_random_uuid(),job_id uuid,guard_id uuid,status text,cover_message text,cover_letter text,applied_at timestamptz,unique(job_id,guard_id));
      create table app.user_entitlements(user_id uuid,plan_slug text);create table app.plans(slug text);create table app.usage(count integer);insert into app.usage values(0);
      create function app.guard_has_current_sia(boolean,text,date,date) returns boolean language sql as $$select $1 and $3 >= $4$$;
      create function app.check_monthly_usage(uuid,text,boolean) returns jsonb language plpgsql as $$begin if $3 then update app.usage set count=count+1;end if;return '{"allowed":true}'::jsonb;end$$;
      insert into app.guards values('${G}','${U}',true,'${U}','approved',current_date+365,true,'SYNTHETIC',array['Door Supervisor']);
      insert into app.jobs values('${J}','open',false,(statement_timestamp() at time zone 'Europe/London')::date-1,false,null,'basic');
      insert into app.user_entitlements values('${U}','guard-basic');insert into app.plans values('guard-basic');
      insert into app.job_invites values('${I}','${G}','${J}','pending',null);`);
    const source=fs.readFileSync('supabase/migrations/20261114174659_require_recorded_guard_admin_approval.sql','utf8');
    const start=source.indexOf('CREATE OR REPLACE FUNCTION app.submit_job_application('),end=source.indexOf('$function$;',start)+'$function$;'.length;
    await db.exec(source.slice(start,end));
    const migration=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_guard_application_expiry.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
    const submit=invite=>db.query('select app.submit_job_application($1,$2,$3,$4,$5,false) as result',[U,G,J,'Synthetic QA',invite||null]);
    const counts=async()=>({usage:(await db.query('select count from app.usage')).rows[0].count,applications:(await db.query('select count(*)::int as n from app.job_applications')).rows[0].n,invite:(await db.query('select status from app.job_invites')).rows[0].status});
    await t.test('past job cannot insert directly or via RPC, consume quota, or accept its invite',async()=>{
      await assert.rejects(submit(I),/qg_apply:job_expired/);
      assert.deepEqual(await counts(),{usage:0,applications:0,invite:'pending'});
      await assert.rejects(db.query('insert into app.job_applications(job_id,guard_id) values($1,$2)',[J,G]),/qg_apply:job_expired/);
    });
    await t.test('today uses London independently of database timezone and can commit one application',async()=>{
      await db.exec("set timezone='Pacific/Kiritimati'");
      await db.query("update app.jobs set start_date=(statement_timestamp() at time zone 'Europe/London')::date where id=$1",[J]);
      const r=await submit();assert.ok(r.rows[0].result.applicationId);
      assert.deepEqual(await counts(),{usage:1,applications:1,invite:'pending'});
    });
    await t.test('historical application updates and invitation replays remain idempotent after expiry',async()=>{
      await db.query("update app.jobs set start_date=(statement_timestamp() at time zone 'Europe/London')::date-1 where id=$1",[J]);
      const r=await submit(I);assert.equal(r.rows[0].result.replayed,true);
      assert.deepEqual(await counts(),{usage:1,applications:1,invite:'accepted'});
      await db.exec("update app.job_applications set status='selected'");
      assert.equal((await db.query('select status from app.job_applications')).rows[0].status,'selected');
    });
    await t.test('missing dates fail closed and private trigger execution is not granted to browser roles',async()=>{
      await db.query('update app.jobs set start_date=null where id=$1',[J]);
      await assert.rejects(db.query('insert into app.job_applications(job_id,guard_id) values($1,$2)',[J,U]),/qg_apply:job_expired/);
      const r=await db.query("select has_function_privilege('anon','app.guard_application_requires_current_job()','EXECUTE') as anon,has_function_privilege('authenticated','app.guard_application_requires_current_job()','EXECUTE') as authenticated");
      assert.deepEqual(r.rows[0],{anon:false,authenticated:false});
    });
  } finally { await db.close(); }
});
