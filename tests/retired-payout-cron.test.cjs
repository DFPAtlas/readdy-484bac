const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('supabase/migrations/20261005143544_deactivate_retired_payout_cron.sql','utf8');

test('migration deactivates retired payout callers, preserving definitions, history and other schedules',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema cron;
   create table cron.job(jobid bigint primary key,jobname text,command text,active boolean);
   create table cron.job_run_details(jobid bigint,status text);
   create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;
   insert into cron.job values
    (7,'auto-release-guard-payments','obsolete invalid body',true),
    (9,'renamed-old-payout','select net.http_post(url := ''https://example.test/functions/v1/auto-release-guard-payments'')',true),
    (11,'process-email-queue','email command',true),
    (13,'other-inactive','other command',false);
   insert into cron.job_run_details values (7,'failed');`);
  const before=(await db.query('select jobid,jobname,command from cron.job order by jobid')).rows;
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select jobid,jobname,command from cron.job order by jobid')).rows,before);
  assert.deepEqual((await db.query('select jobid,active from cron.job order by jobid')).rows,[{jobid:7,active:false},{jobid:9,active:false},{jobid:11,active:true},{jobid:13,active:false}]);
  assert.deepEqual((await db.query('select * from cron.job_run_details')).rows,[{jobid:7,status:'failed'}]);
 } finally {await db.close();}
});
test('migration also runs where pg_cron or the retired job is absent',async()=>{
 const db=new PGlite();
 try {await db.exec(sql);} finally {await db.close();}
});
