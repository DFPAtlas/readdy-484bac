import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const phase2 = fs.readFileSync('supabase/migrations/20261006212325_immediate_booking_phase2.sql', 'utf8');
const fix = fs.readFileSync('supabase/migrations/20261122014216_profile_only_job_match_queue.sql', 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const guard = '22222222-2222-4222-8222-222222222222';
const job = '33333333-3333-4333-8333-333333333333';
const key = `immediate-job:${job}:guard:${guard}`;
async function setup() {
  const db = new PGlite();
  await db.exec(`create schema auth; create schema app;
    create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key);
    create table app.users(id uuid primary key references auth.users(id));
    create table app.email_queue(
      id uuid primary key default gen_random_uuid(),
      user_id uuid references app.users(id) on delete cascade,
      email_type text not null, recipient_email text, recipient_name text,
      subject text, body_html text, status text, priority integer,
      metadata jsonb, dedupe_key text, error_message text, retry_count int default 0,
      created_at timestamptz default now(), updated_at timestamptz);
    alter table app.email_queue enable row level security;
    create policy queue_owner on app.email_queue for select to authenticated
      using(user_id = nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
    grant usage on schema app to anon, authenticated, service_role;
    grant select on app.email_queue to authenticated;
    insert into auth.users values('${user}');`);
  const dedupeStart = phase2.indexOf('CREATE OR REPLACE FUNCTION app.set_email_queue_dedupe_key()');
  const queueStart = phase2.indexOf('CREATE OR REPLACE FUNCTION app.queue_job_match_notification(');
  const queueEnd = phase2.indexOf('-- 6c.',queueStart);
  await db.exec(phase2.slice(dedupeStart,phase2.indexOf('-- 6b-4.')));
  await db.exec(`create trigger dedupe before insert or update on app.email_queue
    for each row execute function app.set_email_queue_dedupe_key();
    create unique index uq_email_queue_job_match_dedupe
      on app.email_queue(dedupe_key) where email_type='job_match';`);
  // Load the deployed predecessor, including its original privilege statements.
  await db.exec(phase2.slice(queueStart,queueEnd > queueStart ? queueEnd : undefined));
  return db;
}
async function queue(db, metadata={guard_id:'spoofed',guard_record_id:'spoofed',job_id:'spoofed',idempotency_key:'spoofed'}) {
  return (await db.query(`select app.queue_job_match_notification(
    $1,$2,$3,'guard@example.invalid','Synthetic Guard','Job match',$4,$5::jsonb,10) outcome`,
    [job,guard,user,key,JSON.stringify(metadata)])).rows[0].outcome;
}
test('profile-only account fails with deployed FK then queues once after the repair', async()=>{
  const db=await setup();
  try {
    await assert.rejects(queue(db), error=>error.code==='23503');
    await db.exec(fix);
    assert.equal(await queue(db),'queued');
    assert.equal(await queue(db),'queued');
    const rows=(await db.query('select * from app.email_queue')).rows;
    assert.equal(rows.length,1); const row=rows[0];
    assert.equal(row.user_id,null); assert.equal(row.status,'pending');
    assert.equal(row.metadata.guard_id,user); assert.equal(row.metadata.guard_record_id,guard);
    assert.equal(row.metadata.job_id,job); assert.equal(row.metadata.idempotency_key,key);
    assert.equal(row.dedupe_key,key); assert.equal(row.priority,10);
    assert.equal((await db.query('select count(*)::int n from app.users')).rows[0].n,0);
    await assert.rejects(db.query('update app.email_queue set user_id=$1',[user]),error=>error.code==='23503');
  } finally {await db.close();}
});
test('legacy mirror association and terminal/retry queue states remain intact',async()=>{
  const db=await setup();
  try {
    await db.exec(fix);
    await db.query('insert into app.users values($1)',[user]);
    assert.equal(await queue(db),'queued');
    assert.equal((await db.query('select user_id from app.email_queue')).rows[0].user_id,user);
    for(const status of ['pending','processing','queued','sending','sent','suppressed','failed']) {
      await db.query('update app.email_queue set status=$1,error_message=$2,retry_count=3',[status,'old failure']);
      assert.equal(await queue(db),status==='sent'?'delivered':status==='suppressed'?'suppressed':status==='failed'?'retried':'queued');
      const row=(await db.query('select * from app.email_queue')).rows[0];
      assert.equal(row.status,status==='failed'?'pending':status);
      if(status==='failed'){assert.equal(row.retry_count,0);assert.equal(row.error_message,null);}
    }
    assert.equal((await db.query('select count(*)::int n from app.email_queue')).rows[0].n,1);
  } finally {await db.close();}
});
test('repair retains queue RLS and FK; only the service role can execute',async()=>{
  const db=await setup();
  try {
    const policyBefore=(await db.query("select * from pg_policies where schemaname='app' and tablename='email_queue'")).rows;
    await db.exec(fix);
    const signature='app.queue_job_match_notification(uuid,uuid,uuid,text,text,text,text,jsonb,integer)';
    for(const role of ['anon','authenticated','service_role']) {
      const result=(await db.query('select has_function_privilege($1,$2,$3) allowed',[role,signature,'execute'])).rows[0];
      assert.equal(result.allowed,role==='service_role');
    }
    assert.deepEqual((await db.query("select * from pg_policies where schemaname='app' and tablename='email_queue'")).rows,policyBefore);
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='app.email_queue'::regclass")).rows[0].relrowsecurity,true);
    assert.equal(await queue(db),'queued');
    await db.exec('set role authenticated');
    assert.equal((await db.query('select count(*)::int n from app.email_queue')).rows[0].n,0);
    await assert.rejects(queue(db),error=>error.code==='42501');
  } finally {await db.close();}
});

